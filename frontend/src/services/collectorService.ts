import type {
  CompleteTask,
  CreateIncident,
  CreateInspection,
  Incident,
  Inspection,
  Task,
  TaskList,
  TaskStatus,
} from '../types/api';
import { apiRequest } from './apiClient';

export const collectorService = {
  listTasks(status?: TaskStatus): Promise<TaskList> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return apiRequest<TaskList>(`/collector/tasks${query}`, {
      method: 'GET',
      auth: 'bearer',
    });
  },

  submitInspection(binId: string, payload: CreateInspection): Promise<Inspection> {
    return apiRequest<Inspection>(`/collector/bins/${encodeURIComponent(binId)}/inspections`, {
      method: 'POST',
      body: payload,
      auth: 'bearer',
    });
  },

  completeTask(taskId: string, payload: CompleteTask): Promise<Task> {
    return apiRequest<Task>(`/collector/tasks/${encodeURIComponent(taskId)}/complete`, {
      method: 'POST',
      body: payload,
      auth: 'bearer',
    });
  },

  reportIncident(payload: CreateIncident): Promise<Incident> {
    return apiRequest<Incident>('/collector/incidents', {
      method: 'POST',
      body: payload,
      auth: 'bearer',
    });
  },
};
