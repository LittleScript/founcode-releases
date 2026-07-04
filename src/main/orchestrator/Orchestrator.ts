// The only component allowed to change task state. Phase 1 scope:
// apply state-machine actions, persist, audit, broadcast. Agent
// integration (plan/execute/verify runners) lands in Phase 2+.

import type { Task } from '../../shared/types'
import type { TaskRepo } from '../store/repositories/TaskRepo'
import { type TaskAction, transition } from './TaskStateMachine'

export type Broadcast = (payload: {
  taskId: string
  from: Task['state']
  to: Task['state']
}) => void

export class Orchestrator {
  constructor(
    private tasks: TaskRepo,
    private broadcastStateChange: Broadcast,
  ) {}

  applyAction(taskId: string, action: TaskAction): Task {
    const task = this.tasks.get(taskId)
    if (!task) throw new Error(`Task not found: ${taskId}`)

    const to = transition(task.state, action)
    this.tasks.setState(taskId, to)
    this.tasks.recordEvent(taskId, 'state_change', { action, from: task.state, to })
    this.broadcastStateChange({ taskId, from: task.state, to })

    const updated = this.tasks.get(taskId)
    if (!updated) throw new Error(`Task disappeared during transition: ${taskId}`)
    return updated
  }
}
