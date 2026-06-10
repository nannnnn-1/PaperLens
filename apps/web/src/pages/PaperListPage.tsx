import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Star,
  StarOff,
  Trash2,
  FileText,
  Upload,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { usePaperStore } from '@/stores/paperStore';
import type { PaperMeta } from '@/types/api';

const statusMap: Record<string, { label: string; color: string }> = {
  UPLOADED: { label: '已上传', color: 'bg-gray-100 text-gray-700' },
  QUEUED: { label: '排队中', color: 'bg-yellow-100 text-yellow-700' },
  PARSING: { label: '解析中', color: 'bg-blue-100 text-blue-700' },
  PARSED: { label: '已解析', color: 'bg-green-100 text-green-700' },
  FAILED: { label: '失败', color: 'bg-red-100 text-red-700' },
};

export default function PaperListPage() {
  const { papers, pagination, isLoading, fetchPapers, uploadPaper, favoritePaper, deletePaper, uploadProgress } =
    usePaperStore();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [showFavOnly, setShowFavOnly] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchPapers();
  }, [fetchPapers]);

  const handleSearch = () => {
    fetchPapers({ q: q || undefined, favorite: showFavOnly || undefined });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      await uploadPaper(file);
      fetchPapers();
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">我的论文</h1>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          上传 PDF
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {isUploading && uploadProgress > 0 && (
        <div className="mb-4 bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-2">上传中... {uploadProgress}%</div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="搜索标题、作者..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
        >
          搜索
        </button>
        <button
          onClick={() => {
            setShowFavOnly(!showFavOnly);
            fetchPapers({ q: q || undefined, favorite: !showFavOnly || undefined });
          }}
          className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-1 ${
            showFavOnly ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Star className="w-4 h-4" />
          收藏
        </button>
      </div>

      {isLoading && papers.length === 0 ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : papers.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">暂无论文，点击右上角上传</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {papers.map((paper) => (
            <PaperCard
              key={paper.id}
              paper={paper}
              onClick={() => navigate(`/papers/${paper.id}`)}
              onFavorite={() => favoritePaper(paper.id, !paper.isFavorite)}
              onDelete={() => {
                if (confirm('确定删除这篇论文吗？')) deletePaper(paper.id);
              }}
            />
          ))}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => fetchPapers({ page, q: q || undefined, favorite: showFavOnly || undefined })}
              className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                page === pagination.page
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {page}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PaperCard({
  paper,
  onClick,
  onFavorite,
  onDelete,
}: {
  paper: PaperMeta;
  onClick: () => void;
  onFavorite: () => void;
  onDelete: () => void;
}) {
  const status = statusMap[paper.parseStatus] || statusMap.UPLOADED;

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${status.color}`}>{status.label}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFavorite();
            }}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {paper.isFavorite ? (
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            ) : (
              <StarOff className="w-4 h-4 text-gray-400" />
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{paper.title}</h3>
      {paper.titleTranslated && (
        <p className="text-sm text-gray-500 mb-2 line-clamp-1">{paper.titleTranslated}</p>
      )}

      <p className="text-sm text-gray-500 mb-3">
        {paper.authors.map((a) => a.name).join(', ') || '未知作者'}
      </p>

      <div className="flex items-center justify-between text-sm text-gray-400">
        <div className="flex items-center gap-1">
          {paper.readingProgress > 0 && (
            <span className="text-blue-600">已读 {Math.round(paper.readingProgress * 100)}%</span>
          )}
        </div>
        <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </div>
  );
}
