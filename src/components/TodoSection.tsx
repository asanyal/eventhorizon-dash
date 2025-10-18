import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { TodoItem, CreateTodoRequest } from '../types/todo';
import { todoApiService } from '../services/todoApi';
import { cn } from '../lib/utils';
import { X, RefreshCw, GripVertical } from 'lucide-react';
import { useTimezone } from '../contexts/TimezoneContext';
import { useSimpleView } from '../contexts/SimpleViewContext';
import { cache, CACHE_KEYS, CACHE_TTL } from '../utils/cacheUtils';


// Helper function to format date as "Sep 23" with timezone conversion
const formatDate = (dateString: string, convertTime: (date: Date) => Date): string => {
  const date = new Date(dateString);
  const convertedDate = convertTime(date);
  return convertedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Order persistence utilities
const ORDER_STORAGE_KEY = 'todo-order';

const saveTodoOrder = (todos: TodoItem[]) => {
  const orderMap = todos.reduce((acc, todo, index) => {
    if (todo.title) {
      acc[todo.title] = index;
    }
    return acc;
  }, {} as Record<string, number>);
  localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(orderMap));
};

const loadTodoOrder = (todos: TodoItem[]): TodoItem[] => {
  try {
    const savedOrder = localStorage.getItem(ORDER_STORAGE_KEY);
    if (!savedOrder) return todos;

    const orderMap = JSON.parse(savedOrder);
    return todos.sort((a, b) => {
      const orderA = orderMap[a.title] ?? 999;
      const orderB = orderMap[b.title] ?? 999;
      return orderA - orderB;
    });
  } catch (error) {
    console.error('Error loading todo order:', error);
    return todos;
  }
};

export const TodoSection = () => {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<'high' | 'low'>('low');
  const [urgency, setUrgency] = useState<'high' | 'low'>('low');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { convertTime } = useTimezone();
  const { isSimpleView } = useSimpleView();

  // Fetch todos on component mount
  useEffect(() => {
    fetchTodos();
  }, []);

  const fetchTodos = async (forceRefresh = false) => {
    try {
      // Try to get from cache first (unless force refresh)
      if (!forceRefresh) {
        const cachedTodos = cache.get<TodoItem[]>(CACHE_KEYS.TODOS());
        if (cachedTodos) {
          console.log(`📦 Using cached todos (${cachedTodos.length} items)`);
          const orderedTodos = loadTodoOrder(cachedTodos);
          setTodos(orderedTodos);
          return;
        }
      }
      
      // Get ALL todos regardless of priority/urgency
      const allTodos = await todoApiService.getTodos({});
      
      // Apply saved order
      const orderedTodos = loadTodoOrder(allTodos);
      
      // Cache the todos
      cache.set(CACHE_KEYS.TODOS(), orderedTodos, { ttl: CACHE_TTL.TODOS });
      
      setTodos(orderedTodos);
    } catch (error) {
      console.error('Error fetching todos:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Clear cache and force refresh
      cache.remove(CACHE_KEYS.TODOS());
      await fetchTodos(true);
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
      // Clear cache and refresh the list
      cache.remove(CACHE_KEYS.TODOS());
      await fetchTodos(true);
    } catch (error) {
      console.error('Error creating todo:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const newTodos = Array.from(todos);
    const [reorderedItem] = newTodos.splice(result.source.index, 1);
    newTodos.splice(result.destination.index, 0, reorderedItem);

    setTodos(newTodos);
    saveTodoOrder(newTodos);
  };

  const handleDelete = async (todoTitle: string) => {
    try {
      await todoApiService.deleteTodoByTitle(todoTitle);
      // Update local state immediately and save order
      const updatedTodos = todos.filter(todo => todo.title !== todoTitle);
      setTodos(updatedTodos);
      saveTodoOrder(updatedTodos);
      // Clear cache
      cache.remove(CACHE_KEYS.TODOS());
    } catch (error) {
      console.error('Error deleting todo:', error);
    }
  };

  // Simple View - Show only essential information
  if (isSimpleView) {
    return (
      <div className="bg-green-50 rounded-lg p-4 border border-green-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-green-800">
            My Tasks
          </h3>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 text-green-600 hover:text-green-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Simple Add Form */}
        <form onSubmit={handleSubmit} className="mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add a task..."
              className="flex-1 px-3 py-2 text-base border border-green-300 rounded-md bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Add
            </button>
          </div>
        </form>

        {/* Simple Tasks List */}
        <div className="space-y-3">
          {todos.length === 0 ? (
            <div className="text-center py-8 text-lg text-green-600">
              All done! 🎉
            </div>
          ) : (
            todos.map((todo, index) => {
              const isHighPriority = todo.priority === 'high' || todo.urgency === 'high';
              
              return (
                <div
                  key={todo.id || index}
                  className={cn(
                    "bg-white rounded-lg p-4 border-2 transition-all duration-200",
                    isHighPriority 
                      ? "border-red-200 hover:border-red-300" 
                      : "border-green-200 hover:border-green-300"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className={cn(
                        "text-lg font-semibold mb-1",
                        isHighPriority ? "text-red-800" : "text-gray-900"
                      )}>
                        {todo.created_at && (
                          <span className="text-base font-medium text-gray-600 mr-2">
                            {formatDate(todo.created_at, convertTime)} -
                          </span>
                        )}
                        {todo.title}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleDelete(todo.title)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                      title="Complete task"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-productivity-surface rounded-lg p-4 border border-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-productivity-text-primary">
            To-do List
          </h3>
          {/* Todo count badge */}
          <div className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full border border-green-200">
            {todos.length}
          </div>
        </div>
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
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="todos">
          {(provided, snapshot) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className={cn(
                "space-y-2 transition-colors duration-200",
                snapshot.isDraggingOver && "bg-blue-50/50 rounded-lg"
              )}
            >
              {todos.length === 0 ? (
                <p className="text-sm text-productivity-text-tertiary">
                  You're all done! Here's a plant 🪴
                </p>
              ) : (
                todos.map((todo, index) => (
                  <Draggable key={todo.title} draggableId={todo.title} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={cn(
                          "group flex items-center gap-2 p-3 rounded-lg border transition-all duration-300 transform hover:scale-[1.02] hover:-translate-y-0.5",
                          snapshot.isDragging && "shadow-lg rotate-2 scale-105 z-50",
                          // Apply urgency-based styling
                          todo.priority === 'high' && todo.urgency === 'high'
                            ? "bg-gradient-to-r from-red-50 via-red-25 to-orange-50 border-red-200 hover:from-red-100 hover:via-red-50 hover:to-orange-100 shadow-sm hover:shadow-md border-l-4 border-l-red-400"
                            : (todo.priority === 'high' || todo.urgency === 'high')
                            ? "bg-gradient-to-r from-orange-50 via-yellow-25 to-orange-50 border-orange-200 hover:from-orange-100 hover:via-yellow-50 hover:to-orange-100 shadow-sm hover:shadow-md border-l-4 border-l-orange-400"
                            : "bg-gradient-to-r from-blue-25 via-slate-25 to-blue-25 border-slate-200 hover:from-blue-50 hover:via-slate-50 hover:to-blue-50 border-l-4 border-l-blue-300"
                        )}
                        style={{
                          ...provided.draggableProps.style,
                          backgroundImage: todo.priority === 'high' && todo.urgency === 'high' 
                            ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.03) 0%, rgba(251, 146, 60, 0.03) 100%)'
                            : undefined
                        }}
                      >
                        {/* Drag Handle */}
                        <div
                          {...provided.dragHandleProps}
                          className="flex-shrink-0 p-1 text-productivity-text-tertiary hover:text-productivity-text-secondary cursor-grab active:cursor-grabbing transition-colors"
                          title="Drag to reorder"
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>

                        {/* Date */}
                        {todo.created_at && (
                          <div className="flex-shrink-0 text-sm text-productivity-text-tertiary">
                            {formatDate(todo.created_at, convertTime)}
                          </div>
                        )}

                        {/* Title */}
                        <div className="flex-1 min-w-0">
                          <div className={cn(
                            "todo-title text-sm break-words leading-tight font-medium transition-colors",
                            todo.priority === 'high' && todo.urgency === 'high'
                              ? "text-red-700 group-hover:text-red-800"
                              : (todo.priority === 'high' || todo.urgency === 'high')
                              ? "text-orange-700 group-hover:text-orange-800"
                              : "text-productivity-text-primary group-hover:text-slate-700"
                          )}>
                            {todo.title}
                          </div>
                        </div>

                        {/* Priority Chip */}
                        <span className={cn(
                          "px-2 py-1 text-xs font-medium rounded-full transition-all duration-200 transform group-hover:scale-105",
                          todo.priority === 'high' 
                            ? "bg-red-500 text-white shadow-sm group-hover:bg-red-600 group-hover:shadow-md" 
                            : "bg-slate-200 text-slate-600 group-hover:bg-slate-300"
                        )}>
                          {todo.priority === 'high' ? '●' : '○'}
                        </span>

                        {/* Urgency Chip */}
                        <span className={cn(
                          "px-2 py-1 text-xs font-medium rounded-full transition-all duration-200 transform group-hover:scale-105",
                          todo.urgency === 'high' 
                            ? "bg-orange-500 text-white shadow-sm group-hover:bg-orange-600 group-hover:shadow-md" 
                            : "bg-slate-200 text-slate-600 group-hover:bg-slate-300"
                        )}>
                          {todo.urgency === 'high' ? '▲' : '▽'}
                        </span>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDelete(todo.title)}
                          className={cn(
                            "p-2 rounded-full transition-all duration-200 transform hover:scale-110 group-hover:bg-white/50",
                            todo.priority === 'high' && todo.urgency === 'high'
                              ? "text-red-400 hover:text-red-600 hover:bg-red-50"
                              : "text-productivity-text-tertiary hover:text-red-500 hover:bg-red-50"
                          )}
                          title={`Complete "${todo.title}" - Get it done! 💪`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </Draggable>
                ))
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
};
