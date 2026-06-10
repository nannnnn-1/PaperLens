import { useState } from 'react';
import { X, Plus, Tag, Trash2 } from 'lucide-react';
import { useReadingStore } from '@/stores/readingStore';
import type { AnnotationType } from '@/types/api';

const annotationLabels: Record<AnnotationType, string> = {
  ALGORITHM: '算法',
  CONCEPT: '概念',
  DATASET_METRIC: '数据集/指标',
  CITATION: '引用',
  CODE_TOOL: '代码/工具',
};

interface AnnotationDrawerProps {
  paperId: string;
  annotationColors: Record<AnnotationType, string>;
}

export default function AnnotationDrawer({ paperId, annotationColors }: AnnotationDrawerProps) {
  const { annotations, fetchAnnotations, addAnnotation, removeAnnotation, setAnnotationDrawerOpen } = useReadingStore();
  const [filterType, setFilterType] = useState<AnnotationType | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newAnno, setNewAnno] = useState<{ type: AnnotationType; text: string; label: string; definition: string }>({
    type: 'CONCEPT',
    text: '',
    label: '',
    definition: '',
  });

  const filtered = filterType ? annotations.filter((a) => a.type === filterType) : annotations;

  const handleAdd = async () => {
    if (!newAnno.text.trim()) return;
    await addAnnotation(paperId, {
      type: newAnno.type,
      text: newAnno.text.trim(),
      label: newAnno.label.trim() || undefined,
      definition: newAnno.definition.trim() || undefined,
    });
    setIsAdding(false);
    setNewAnno({ type: 'CONCEPT', text: '', label: '', definition: '' });
    fetchAnnotations(paperId);
  };

  return (
    <div className="w-80 border-l border-gray-200 bg-white flex flex-col">
      <div className="h-12 border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Tag className="w-4 h-4" />
          标注 ({annotations.length})
        </h3>
        <button onClick={() => setAnnotationDrawerOpen(false)} className="p-1 hover:bg-gray-100 rounded">
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="px-3 py-2 border-b border-gray-100 flex flex-wrap gap-1">
        <button
          onClick={() => setFilterType(null)}
          className={`text-xs px-2 py-1 rounded-full transition-colors ${filterType === null ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          全部
        </button>
        {(Object.keys(annotationLabels) as AnnotationType[]).map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(filterType === type ? null : type)}
            className={`text-xs px-2 py-1 rounded-full transition-colors ${
              filterType === type ? 'bg-gray-800 text-white' : annotationColors[type].replace('border-', '')
            }`}
          >
            {annotationLabels[type]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.map((anno) => (
          <div
            key={anno.id}
            className={`p-3 rounded-lg border text-sm ${annotationColors[anno.type]}`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium">{anno.text}</span>
              {anno.createdBy === 'USER' && (
                <button
                  onClick={() => removeAnnotation(paperId, anno.id)}
                  className="p-1 hover:bg-white/50 rounded opacity-0 hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
            {anno.label && <div className="text-xs opacity-80">{anno.label}</div>}
            {anno.definition && <div className="text-xs opacity-70 mt-1">{anno.definition}</div>}
            <div className="text-[10px] opacity-50 mt-1">{annotationLabels[anno.type]} · {anno.createdBy === 'AGENT' ? 'AI' : '用户'}</div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-8">暂无标注</div>
        )}
      </div>

      {/* Add button */}
      <div className="p-3 border-t border-gray-200 shrink-0">
        {!isAdding ? (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors flex items-center justify-center gap-1"
          >
            <Plus className="w-4 h-4" />
            添加标注
          </button>
        ) : (
          <div className="space-y-2">
            <select
              value={newAnno.type}
              onChange={(e) => setNewAnno({ ...newAnno, type: e.target.value as AnnotationType })}
              className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5"
            >
              {(Object.keys(annotationLabels) as AnnotationType[]).map((t) => (
                <option key={t} value={t}>{annotationLabels[t]}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="标注文本*"
              value={newAnno.text}
              onChange={(e) => setNewAnno({ ...newAnno, text: e.target.value })}
              className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5"
            />
            <input
              type="text"
              placeholder="标签（可选）"
              value={newAnno.label}
              onChange={(e) => setNewAnno({ ...newAnno, label: e.target.value })}
              className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5"
            />
            <textarea
              placeholder="定义（可选）"
              value={newAnno.definition}
              onChange={(e) => setNewAnno({ ...newAnno, definition: e.target.value })}
              className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 resize-none h-16"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setIsAdding(false)}
                className="flex-1 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleAdd}
                className="flex-1 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                保存
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
