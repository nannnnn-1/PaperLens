import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Archive, MessageSquare, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { usePaperStore } from '@/stores/paperStore';
import { useReadingStore } from '@/stores/readingStore';
import { useChatStore } from '@/stores/chatStore';
import { sseManager } from '@/lib/sse';
import BlockRenderer from '@/components/reading/BlockRenderer';
import AnnotationDrawer from '@/components/reading/AnnotationDrawer';
import FigurePanel from '@/components/reading/FigurePanel';
import ChatDrawer from '@/components/reading/ChatDrawer';
import PDFThumbnails from '@/components/reading/PDFThumbnails';
import type { AnnotationType } from '@/types/api';

const annotationColors: Record<AnnotationType, string> = {
  ALGORITHM: 'bg-purple-100 text-purple-800 border-purple-200',
  CONCEPT: 'bg-blue-100 text-blue-800 border-blue-200',
  DATASET_METRIC: 'bg-green-100 text-green-800 border-green-200',
  CITATION: 'bg-orange-100 text-orange-800 border-orange-200',
  CODE_TOOL: 'bg-pink-100 text-pink-800 border-pink-200',
};

export default function ReadingRoomPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const paperId = id!;

  const { currentPaper, fetchPaperDetail } = usePaperStore();
  const {
    blocks,
    annotations,
    figures,
    fetchBlocks,
    fetchAnnotations,
    fetchFigures,
    setSelectedText,
    setSelectedBlockId,
    isAnnotationDrawerOpen,
    setAnnotationDrawerOpen,
  } = useReadingStore();
  const { isOpen: isChatOpen, openChat, closeChat } = useChatStore();

  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [showFigures, setShowFigures] = useState(false);
  const [parseProgress, setParseProgress] = useState<number | null>(null);

  useEffect(() => {
    sseManager.connect();
    const unsubProgress = sseManager.on('paper:parse:progress', (data) => {
      if (data.paperId === paperId) setParseProgress(data.progress);
    });
    const unsubComplete = sseManager.on('paper:parse:complete', (data) => {
      if (data.paperId === paperId) {
        setParseProgress(null);
        fetchPaperDetail(paperId);
        fetchBlocks(paperId);
        fetchAnnotations(paperId);
        fetchFigures(paperId);
      }
    });
    return () => {
      unsubProgress();
      unsubComplete();
    };
  }, [paperId, fetchPaperDetail, fetchBlocks, fetchAnnotations, fetchFigures]);

  useEffect(() => {
    fetchPaperDetail(paperId);
    fetchBlocks(paperId);
    fetchAnnotations(paperId);
    fetchFigures(paperId);
  }, [paperId, fetchPaperDetail, fetchBlocks, fetchAnnotations, fetchFigures]);

  const handleTextSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) {
      setSelectedText(sel.toString().trim());
    } else {
      setSelectedText(null);
    }
  }, [setSelectedText]);

  const handleBlockClick = useCallback(
    (blockId: string) => {
      setActiveBlockId(blockId);
      setSelectedBlockId(blockId);
    },
    [setSelectedBlockId]
  );

  const isParsed = currentPaper?.parseStatus === 'PARSED';

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col bg-white">
      {/* Top bar */}
      <div className="h-12 border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <h2 className="text-sm font-medium text-gray-900 line-clamp-1 max-w-md">
            {currentPaper?.title || '加载中...'}
          </h2>
          {currentPaper?.parseStatus && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {currentPaper.parseStatus}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFigures(!showFigures)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1 ${
              showFigures ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            图表 ({figures.length})
          </button>
          <button
            onClick={() => setAnnotationDrawerOpen(!isAnnotationDrawerOpen)}
            className="px-3 py-1.5 text-sm rounded-lg hover:bg-gray-100 text-gray-600 transition-colors flex items-center gap-1"
          >
            {isAnnotationDrawerOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
            标注
          </button>
          <button
            onClick={() => navigate(`/papers/${paperId}/archive`)}
            className="px-3 py-1.5 text-sm rounded-lg hover:bg-gray-100 text-gray-600 transition-colors flex items-center gap-1"
          >
            <Archive className="w-4 h-4" />
            档案
          </button>
          <button
            onClick={() => (isChatOpen ? closeChat() : openChat())}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1 ${
              isChatOpen ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            对话
          </button>
        </div>
      </div>

      {/* Parse progress */}
      {parseProgress !== null && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-3">
          <div className="text-sm text-blue-700">PDF 解析中...</div>
          <div className="flex-1 bg-blue-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${parseProgress}%` }} />
          </div>
          <span className="text-sm text-blue-700">{Math.round(parseProgress)}%</span>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left-Right split */}
        <div className="flex-1 flex overflow-hidden">
          {/* Original text */}
          <div
            className="w-1/2 border-r border-gray-200 overflow-y-auto"
            onMouseUp={handleTextSelection}
          >
            <div className="p-6 space-y-1">
              {blocks.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                  {isParsed ? '暂无内容' : '等待解析完成...'}
                </div>
              ) : (
                blocks.map((block) => (
                  <BlockRenderer
                    key={block.id}
                    block={block}
                    annotations={annotations.filter((a) => a.evidence?.some((e) => e.blockId === block.id))}
                    isActive={activeBlockId === block.id}
                    onClick={() => handleBlockClick(block.id)}
                    annotationColors={annotationColors}
                  />
                ))
              )}
            </div>
          </div>

          {/* Translation */}
          <div className="w-1/2 overflow-y-auto bg-gray-50/50">
            <div className="p-6 space-y-1">
              {blocks.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                  {isParsed ? '暂无内容' : '等待解析完成...'}
                </div>
              ) : (
                blocks.map((block) => (
                  <div
                    key={`trans-${block.id}`}
                    className={`py-1 ${
                      block.blockType === 'HEADING'
                        ? 'font-semibold text-gray-900'
                        : 'text-gray-700 leading-relaxed'
                    } ${activeBlockId === block.id ? 'bg-yellow-50/50' : ''}`}
                    style={block.level ? { paddingLeft: `${(block.level - 1) * 16}px` } : undefined}
                  >
                    {block.translation ? (
                      <span>{block.translation}</span>
                    ) : (
                      <span className="text-gray-300 italic">未翻译</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right drawers */}
        {isAnnotationDrawerOpen && (
          <AnnotationDrawer paperId={paperId} annotationColors={annotationColors} />
        )}
        {showFigures && <FigurePanel paperId={paperId} onClose={() => setShowFigures(false)} />}
      </div>

      {/* Bottom thumbnails */}
      <PDFThumbnails paperId={paperId} blocks={blocks} activeBlockId={activeBlockId} onSelectBlock={setActiveBlockId} />

      {/* Bottom chat drawer */}
      {isChatOpen && <ChatDrawer paperId={paperId} />}
    </div>
  );
}
