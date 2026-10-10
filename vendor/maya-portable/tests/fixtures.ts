import type { A2UIScreen } from '../src/core/types.js';
export const taskScreen: A2UIScreen = {
  type: 'a2ui_screen', screenId: 'tasks', assistantMessage: 'Tu lista está lista.',
  components: [{ id: 'card', type: 'Card', props: { title: 'Proyecto nuevo' }, children: [
    { id: 'label', type: 'Text', props: { content: 'Revisar el diseño' } },
    { id: 'action', type: 'ActionButton', props: { label: 'Completar tarea', actionType: 'COMPLETE_TASK', payload: { taskId: 'task-1' } } }
  ] }], suggestedPrompts: ['Añade una tarea']
};
