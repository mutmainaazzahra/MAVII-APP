import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { TaskList, Task } from '../models/task.model';
import { HistoryItem } from '../models/history.model';

@Injectable({
  providedIn: 'root',
})
export class OfflineStorageService {
  private readonly KEYS = {
    TASKS_CACHE: 'tasks_cache',
    HISTORY_CACHE: 'history_cache',
    TASK_DETAIL_PREFIX: 'task_detail_',
    OFFLINE_QUEUE: 'offline_queue',
  };

  async saveTasksCache(tasks: TaskList[]): Promise<void> {
    await Preferences.set({
      key: this.KEYS.TASKS_CACHE,
      value: JSON.stringify(tasks),
    });
  }

  async getTasksCache(): Promise<TaskList[]> {
    const { value } = await Preferences.get({ key: this.KEYS.TASKS_CACHE });
    return value ? JSON.parse(value) : [];
  }

  async saveTaskDetail(id: number, task: Task): Promise<void> {
    await Preferences.set({
      key: `${this.KEYS.TASK_DETAIL_PREFIX}${id}`,
      value: JSON.stringify(task),
    });
  }

  async getTaskDetail(id: number): Promise<Task | null> {
    const { value } = await Preferences.get({
      key: `${this.KEYS.TASK_DETAIL_PREFIX}${id}`,
    });
    return value ? JSON.parse(value) : null;
  }

  async saveHistoryCache(history: HistoryItem[]): Promise<void> {
    await Preferences.set({
      key: this.KEYS.HISTORY_CACHE,
      value: JSON.stringify(history),
    });
  }

  async getHistoryCache(): Promise<HistoryItem[]> {
    const { value } = await Preferences.get({ key: this.KEYS.HISTORY_CACHE });
    return value ? JSON.parse(value) : [];
  }

  async addToQueue(action: {
    type: string;
    taskId: number;
    data: any;
    timestamp: string;
  }): Promise<void> {
    const queue = await this.getQueue();
    queue.push(action);
    await Preferences.set({
      key: this.KEYS.OFFLINE_QUEUE,
      value: JSON.stringify(queue),
    });
  }

  async getQueue(): Promise<any[]> {
    const { value } = await Preferences.get({ key: this.KEYS.OFFLINE_QUEUE });
    return value ? JSON.parse(value) : [];
  }

  async clearQueue(): Promise<void> {
    await Preferences.remove({ key: this.KEYS.OFFLINE_QUEUE });
  }

  async clearAllCache(): Promise<void> {
    await Preferences.remove({ key: this.KEYS.TASKS_CACHE });
    await Preferences.remove({ key: this.KEYS.HISTORY_CACHE });
    await Preferences.remove({ key: this.KEYS.OFFLINE_QUEUE });
    console.log('🗑️ All cache cleared');
  }
}
