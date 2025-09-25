export interface TodoItem {
  id?: string;
  title: string;
  urgency: 'high' | 'low';
  priority: 'high' | 'low';
  created_at?: string;
}

export interface CreateTodoRequest {
  title: string;
  urgency: 'high' | 'low';
  priority: 'high' | 'low';
}

export interface GetTodosParams {
  urgency?: 'high' | 'low';
  priority?: 'high' | 'low';
}
