import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, MessageSquare, PenTool, Tag, Activity } from 'lucide-react';
import { useReadingStore } from '@/stores/readingStore';
import { usePaperStore } from '@/stores/paperStore';

export default function ArchivePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const paperId = id!;

  const { archive, isLoading, fetchArchive } = useReadingStore();
  const { currentPaper, fetchPaperDetail } = usePaperStore();

  useEffect(() => {
    fetchPaperDetail(paperId);
    fetchArchive(paperId);
  }, [paperId, fetchArchive, fetchPaperDetail]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(`/papers/${paperId}`)}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">论文理解档案</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">{currentPaper?.title}</h2>
        {currentPaper?.titleTranslated && (
          <p className="text-gray-500 mb-2">{currentPaper.titleTranslated}</p>
        )}
        <p className="text-sm text-gray-400">
          {currentPaper?.authors.map((a) => a.name).join(', ')}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : archive ? (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={<BookOpen className="w-5 h-5" />} label="方法卡片" value={archive.methodCards.length} />
            <StatCard icon={<MessageSquare className="w-5 h-5" />} label="问答次数" value={archive.qaCount} />
            <StatCard icon={<PenTool className="w-5 h-5" />} label="笔记数量" value={archive.noteCount} />
            <StatCard icon={<Tag className="w-5 h-5" />} label="标注数量" value={archive.annotationCount} />
          </div>

          {/* Method Cards */}
          {archive.methodCards.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-600" />
                方法卡片
              </h3>
              <div className="space-y-4">
                {archive.methodCards.map((card) => (
                  <div key={card.id} className="border border-gray-100 rounded-lg p-4 bg-gray-50/50">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{card.name}</h4>
                      {card.category && (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{card.category}</span>
                      )}
                    </div>
                    {card.backbone && (
                      <div className="text-sm text-gray-600 mb-1">Backbone: {card.backbone}</div>
                    )}
                    {card.datasets.length > 0 && (
                      <div className="text-sm text-gray-600 mb-1">
                        数据集: {card.datasets.map((d) => d.name).join(', ')}
                      </div>
                    )}
                    {card.metrics.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {card.metrics.map((m, i) => (
                          <span key={i} className="text-xs px-2 py-1 bg-white border border-gray-200 rounded-md">
                            {m.name}: {m.value} {m.unit || ''}
                          </span>
                        ))}
                      </div>
                    )}
                    {card.isCodeAvailable && card.codeUrl && (
                      <a
                        href={card.codeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline mt-2 inline-block"
                      >
                        查看代码
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Agent Logs */}
          {archive.agentLogs.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-green-600" />
                AI 处理记录
              </h3>
              <div className="space-y-2">
                {archive.agentLogs.map((log, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className="text-gray-400 text-xs">{new Date(log.createdAt).toLocaleString()}</span>
                    <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-600 text-xs">{log.agentType}</span>
                    <span className="text-gray-700">{log.action}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-20 text-gray-400">暂无档案数据</div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">{icon}</div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-sm text-gray-500">{label}</div>
      </div>
    </div>
  );
}
