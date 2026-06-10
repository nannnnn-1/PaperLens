import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, MessageCircle, ChevronDown } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';
import { useReadingStore } from '@/stores/readingStore';

interface ChatDrawerProps {
  paperId: string;
}

export default function ChatDrawer({ paperId }: ChatDrawerProps) {
  const { messages, isLoading, sendMessage, closeChat } = useChatStore();
  const { selectedText, selectedBlockId } = useReadingStore();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    setInput('');
    await sendMessage(paperId, text, selectedText || undefined, selectedBlockId ? [selectedBlockId] : undefined);
  };

  return (
    <div className="h-80 border-t border-gray-200 bg-white flex flex-col shrink-0">
      {/* Header */}
      <div className="h-10 border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-gray-900">选中再聊</span>
          {selectedText && (
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full truncate max-w-[200px]">
              已选: {selectedText.slice(0, 20)}{selectedText.length > 20 ? '...' : ''}
            </span>
          )}
        </div>
        <button onClick={closeChat} className="p-1 hover:bg-gray-100 rounded">
          <ChevronDown className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-8">
            选中论文中的文字，或在此直接提问
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>
              {msg.isStreaming && (
                <span className="inline-block w-1.5 h-3 bg-current animate-pulse ml-0.5" />
              )}
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200/50 flex flex-wrap gap-1">
                  {msg.citations.map((c, i) => (
                    <span
                      key={i}
                      className="text-[10px] bg-white/80 text-gray-600 px-1.5 py-0.5 rounded"
                      title={c.excerpt}
                    >
                      [{c.paperIndex + 1}]
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-xl px-3 py-2 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              <span className="text-sm text-gray-500">思考中...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="h-14 border-t border-gray-200 px-4 flex items-center gap-2 shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={selectedText ? '针对选中的文字提问...' : '输入问题...'}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
