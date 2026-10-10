// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { A2UIRenderer, MayaAssistant } from '../src/react/index.js';
import type { MayaRequest } from '../src/core/types.js';
import { taskScreen } from './fixtures.js';
import { FakeRecognition } from './fakeRecognition.js';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('renders a nested interface and forwards arbitrary action payloads', async () => {
  const onAction = vi.fn(); render(<A2UIRenderer screen={taskScreen} onAction={onAction} />);
  expect(screen.getByRole('heading', { name: 'Proyecto nuevo' })).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'Completar tarea' }));
  expect(onAction).toHaveBeenCalledExactlyOnceWith({ type: 'COMPLETE_TASK', payload: { taskId: 'task-1' }, componentId: 'action' });
});
it('sends updated field values and host payloads from generated inputs', async () => {
  const onAction = vi.fn();
  render(<A2UIRenderer screen={{ ...taskScreen, components: [{ id: 'name', type: 'TextInput', props: {
    label: 'Nombre', actionType: 'RENAME_ITEM', payload: { itemId: '1' }, defaultValue: 'Antes'
  } }] }} onAction={onAction} />);
  await userEvent.clear(screen.getByLabelText('Nombre')); await userEvent.type(screen.getByLabelText('Nombre'), 'Después');
  await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
  expect(onAction).toHaveBeenCalledExactlyOnceWith({ type: 'RENAME_ITEM', componentId: 'name',
    payload: { itemId: '1', name: 'name', value: 'Después' } });
});
it('runs written input, generated actions and voice through the same client', async () => {
  vi.stubGlobal('webkitSpeechRecognition', FakeRecognition);
  const process = vi.fn(async (_request: MayaRequest) => taskScreen);
  render(<MayaAssistant client={{ process }} context={{ projectId: 'new' }} />);
  await userEvent.type(screen.getByLabelText('Tu solicitud'), 'Crea una lista');
  await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
  await screen.findByRole('button', { name: 'Completar tarea' });
  expect(process.mock.calls[0][0]).toMatchObject({ message: 'Crea una lista', context: { projectId: 'new' } });
  await userEvent.click(screen.getByRole('button', { name: 'Completar tarea' }));
  await waitFor(() => expect(process).toHaveBeenCalledTimes(2));
  expect(process.mock.calls[1][0]).toMatchObject({ action: { type: 'COMPLETE_TASK', payload: { taskId: 'task-1' } }, screen: taskScreen });
  await userEvent.click(screen.getByRole('button', { name: 'Dictar por voz' }));
  FakeRecognition.current.result('Cambia el título por voz', true);
  FakeRecognition.current.onend?.();
  await waitFor(() => expect(process).toHaveBeenCalledTimes(3));
  expect(process.mock.calls[2][0].message).toBe('Cambia el título por voz');
});
it('keeps text usable when voice is unsupported and does not replay failed requests', async () => {
  const process = vi.fn(async () => { throw new Error('Proveedor sin configurar'); });
  render(<MayaAssistant client={{ process }} />);
  expect((screen.getByRole('button', { name: 'Dictar por voz' }) as HTMLButtonElement).disabled).toBe(true);
  await userEvent.type(screen.getByLabelText('Tu solicitud'), 'Una interfaz');
  await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Proveedor sin configurar');
  expect(process).toHaveBeenCalledOnce();
});
it('renders host components registered outside the built-in catalog', () => {
  render(<A2UIRenderer screen={{ ...taskScreen, components: [{ id: 'custom', type: 'TaskBoard', props: {} }] }}
    onAction={vi.fn()} components={{ TaskBoard: () => <div>Tablero propio</div> }} />);
  expect(screen.getByText('Tablero propio')).toBeTruthy();
});
