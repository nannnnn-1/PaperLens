import { useMemo } from 'react';
import { FileText } from 'lucide-react';
import type { SemanticBlock } from '@/types/api';

interface PDFThumbnailsProps {
  paperId: string;
  blocks: SemanticBlock[];
  activeBlockId: string | null;
  onSelectBlock: (id: string) => void;
}

export default function PDFThumbnails({ blocks, activeBlockId, onSelectBlock }: PDFThumbnailsProps) {
  const pageBlocks = useMemo(() => {
    const map = new Map<number, SemanticBlock[]>();
    blocks.forEach((b) => {
      const page = b.pageNumber || 1;
      if (!map.has(page)) map.set(page, []);
      map.get(page)!.push(b);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [blocks]);

  if (pageBlocks.length === 0) {
    return (
      <div className="h-16 border-t border-gray-200 bg-gray-50 flex items-center justify-center text-sm text-gray-400 shrink-0">
        <FileText className="w-4 h-4 mr-2" />
        暂无页面导航
      </div>
    );
  }

  return (
    <div className="h-20 border-t border-gray-200 bg-gray-50 shrink-0 overflow-x-auto">
      <div className="flex items-center gap-2 px-4 py-2 h-full">
        {pageBlocks.map(([pageNum, pBlocks]) => {
          const isActive = pBlocks.some((b) => b.id === activeBlockId);
          return (
            <button
              key={pageNum}
              onClick={() => {
                const firstBlock = pBlocks[0];
                if (firstBlock) onSelectBlock(firstBlock.id);
              }}
              className={`flex-shrink-0 w-14 h-14 bg-white border rounded-md flex flex-col items-center justify-center text-xs transition-all ${
                isActive
                  ? 'border-blue-500 ring-2 ring-blue-200 text-blue-600'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <FileText className="w-5 h-5 mb-0.5" />
              <span>{pageNum}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
