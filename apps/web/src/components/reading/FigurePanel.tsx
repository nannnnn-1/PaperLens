import { useState } from 'react';
import { X, Image, Loader2 } from 'lucide-react';
import { useReadingStore } from '@/stores/readingStore';
import { readingApi } from '@/lib/api';
import type { FigureDetail } from '@/types/api';

interface FigurePanelProps {
  paperId: string;
  onClose: () => void;
}

export default function FigurePanel({ paperId, onClose }: FigurePanelProps) {
  const { figures } = useReadingStore();
  const [selectedFigure, setSelectedFigure] = useState<FigureDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSelect = async (figureId: string) => {
    setIsLoading(true);
    try {
      const res = await readingApi.figure(paperId, figureId);
      setSelectedFigure(res);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-80 border-l border-gray-200 bg-white flex flex-col">
      <div className="h-12 border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Image className="w-4 h-4" />
          图表 ({figures.length})
        </h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {figures.map((fig) => (
          <button
            key={fig.id}
            onClick={() => handleSelect(fig.id)}
            className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all bg-white"
          >
            <div className="aspect-video bg-gray-100 rounded-md mb-2 overflow-hidden flex items-center justify-center">
              {fig.thumbUrl ? (
                <img src={fig.thumbUrl} alt={fig.caption || `Figure ${fig.figureIndex}`} className="w-full h-full object-contain" />
              ) : (
                <Image className="w-8 h-8 text-gray-300" />
              )}
            </div>
            <div className="text-sm font-medium text-gray-900">图 {fig.figureIndex}</div>
            {fig.caption && (
              <div className="text-xs text-gray-500 line-clamp-2 mt-0.5">{fig.caption}</div>
            )}
          </button>
        ))}

        {figures.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-8">暂无图表</div>
        )}
      </div>

      {/* Figure overlay */}
      {selectedFigure && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-8"
          onClick={() => setSelectedFigure(null)}
        >
          <div
            className="bg-white rounded-xl max-w-4xl max-h-[90vh] w-full overflow-hidden flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-12 border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
              <h4 className="font-medium text-gray-900">图 {selectedFigure.figureIndex}</h4>
              <button onClick={() => setSelectedFigure(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {isLoading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center min-h-[300px]">
                    <img
                      src={selectedFigure.imageUrl || selectedFigure.thumbUrl}
                      alt={selectedFigure.caption || ''}
                      className="max-w-full max-h-[60vh] object-contain"
                    />
                  </div>
                  <div className="text-sm text-gray-700">
                    <div className="font-medium mb-1">标题</div>
                    <p>{selectedFigure.caption || '无标题'}</p>
                  </div>
                  {selectedFigure.captionTranslated && (
                    <div className="text-sm text-gray-600">
                      <div className="font-medium mb-1">译文</div>
                      <p>{selectedFigure.captionTranslated}</p>
                    </div>
                  )}
                  {selectedFigure.aiAnalysis && (
                    <div className="bg-blue-50 rounded-lg p-4 text-sm">
                      <div className="font-medium text-blue-800 mb-1">AI 解读</div>
                      <p className="text-blue-700">{selectedFigure.aiAnalysis}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
