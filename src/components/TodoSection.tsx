import { useState, useEffect } from 'react';
import { TodoItem, CreateTodoRequest } from '../types/todo';
import { todoApiService } from '../services/todoApi';
import { cn } from '../lib/utils';
import { X, RefreshCw } from 'lucide-react';


// Helper function to format date as "Sep 23"
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const TodoSection = () => {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<'high' | 'low'>('low');
  const [urgency, setUrgency] = useState<'high' | 'low'>('low');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch todos on component mount
  useEffect(() => {
    fetchTodos();
  }, []);

  const fetchTodos = async () => {
    try {
      // Get ALL todos regardless of priority/urgency
      const allTodos = await todoApiService.getTodos({});
      setTodos(allTodos);
    } catch (error) {
      console.error('Error fetching todos:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchTodos();
    } finally {
      setRefreshing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      const newTodo: CreateTodoRequest = {
        title: title.trim(),
        urgency,
        priority
      };

      await todoApiService.createTodo(newTodo);
      setTitle('');
      setPriority('low');
      setUrgency('low');
      await fetchTodos(); // Refresh the list
    } catch (error) {
      console.error('Error creating todo:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (todoTitle: string) => {
    try {
      await todoApiService.deleteTodoByTitle(todoTitle);
      // Refresh the list after successful deletion
      await fetchTodos();
    } catch (error) {
      console.error('Error deleting todo:', error);
    }
  };

  return (
    <div className="bg-productivity-surface rounded-lg p-4 border border-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-productivity-text-primary">
          To-do List
        </h3>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-1 text-productivity-text-secondary hover:text-productivity-text-primary transition-colors"
          title="Refresh To-do List"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="space-y-3 mb-4">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a to-do..."
          className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-productivity-text-primary placeholder-productivity-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          disabled={loading}
        />
        
        {/* Priority and Urgency Chips */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPriority(priority === 'high' ? 'low' : 'high')}
            className={cn(
              "px-2 py-1 text-xs font-medium rounded-full transition-colors",
              priority === 'high'
                ? "bg-red-500 text-white"
                : "bg-gray-200 text-gray-600 hover:bg-gray-300"
            )}
          >
            HP
          </button>
          
          <button
            type="button"
            onClick={() => setUrgency(urgency === 'high' ? 'low' : 'high')}
            className={cn(
              "px-2 py-1 text-xs font-medium rounded-full transition-colors",
              urgency === 'high'
                ? "bg-orange-500 text-white"
                : "bg-gray-200 text-gray-600 hover:bg-gray-300"
            )}
          >
            U
          </button>
        </div>
      </form>

      {/* TODO Table */}
      <div className="space-y-2">
        {todos.length === 0 ? (
          <p className="text-sm text-productivity-text-tertiary">
            You're all done! Here's a plant 🪴
          </p>
        ) : (
          todos.map((todo, index) => (
            <div
              key={todo.id || index}
              className="flex items-center gap-2 p-2 bg-background rounded border border-border hover:bg-table-row-hover transition-colors"
            >
              {/* Date */}
              {todo.created_at && (
                <div className="flex-shrink-0 text-xs text-productivity-text-tertiary">
                  {formatDate(todo.created_at)}
                </div>
              )}

              {/* Title */}
              <div className="flex-1 min-w-0">
                <div className="text-productivity-text-primary text-xs break-words leading-tight">
                  {todo.title}
                </div>
              </div>

              {/* Priority Chip */}
              <span className={cn(
                "px-2 py-1 text-xs font-medium rounded-full",
                todo.priority === 'high' 
                  ? "bg-red-500 text-white" 
                  : "bg-gray-200 text-gray-600"
              )}>
                HP
              </span>

              {/* Urgency Chip */}
              <span className={cn(
                "px-2 py-1 text-xs font-medium rounded-full",
                todo.urgency === 'high' 
                  ? "bg-orange-500 text-white" 
                  : "bg-gray-200 text-gray-600"
              )}>
                U
              </span>

              {/* Delete Button */}
              <button
                onClick={() => handleDelete(todo.title)}
                className="p-1 text-productivity-text-tertiary hover:text-red-500 transition-colors"
                title={`Delete "${todo.title}"`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
