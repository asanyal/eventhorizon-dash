import { TodoItem, CreateTodoRequest, GetTodosParams } from '../types/todo';
import { API_CONFIG } from '../config/api';

export class TodoApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_CONFIG.baseUrl) {
    this.baseUrl = baseUrl;
  }

  async createTodo(todo: CreateTodoRequest): Promise<TodoItem> {
    try {
      const response = await fetch(`${this.baseUrl}/add-todos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(todo),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error creating todo:', error);
      throw error;
    }
  }

  async getTodos(params: GetTodosParams): Promise<TodoItem[]> {
    const url = new URL(`${this.baseUrl}/get-todos`);
    
    if (params.urgency) {
      url.searchParams.append('urgency', params.urgency);
    }
    if (params.priority) {
      url.searchParams.append('priority', params.priority);
    }

    try {
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching todos:', error);
      throw error;
    }
  }

  async deleteTodoByTitle(title: string): Promise<void> {
    const url = new URL(`${this.baseUrl}/delete-todo-by-title`);
    url.searchParams.append('title', title);

    try {
      const response = await fetch(url.toString(), {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error deleting todo:', error);
      throw error;
    }
  }
}

// Create a singleton instance
export const todoApiService = new TodoApiService();
