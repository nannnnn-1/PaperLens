import type { SemanticBlock, Annotation } from '@/types/api';
import type { AnnotationType } from '@/types/api';
import { useReadingStore } from '@/stores/readingStore';

interface BlockRendererProps {
  block: SemanticBlock;
  annotations: Annotation[];
  isActive: boolean;
  onClick: () => void;
  annotationColors: Record<AnnotationType, string>;
}

export default function BlockRenderer({ block, annotations, isActive, onClick, annotationColors }: BlockRendererProps) {
  const { setHoveredAnnotationId, hoveredAnnotationId } = useReadingStore();

  const baseClasses = 'py-1 rounded transition-colors cursor-pointer';
  const activeClasses = isActive ? 'bg-yellow-50' : 'hover:bg-gray-50';

  const handleMouseEnterAnnotation = (annotationId: string) => {
    setHoveredAnnotationId(annotationId);
  };

  const handleMouseLeaveAnnotation = () => {
    setHoveredAnnotationId(null);
  };

  if (block.blockType === 'HEADING') {
    const Tag = block.level === 1 ? 'h1' : block.level === 2 ? 'h2' : 'h3';
    return (
      <div className={`${baseClasses} ${activeClasses}`} onClick={onClick}>
        <Tag
          className="font-bold text-gray-900"
          style={{ paddingLeft: `${((block.level || 1) - 1) * 16}px`, fontSize: block.level === 1 ? '1.25rem' : block.level === 2 ? '1.125rem' : '1rem' }}
        >
          {renderAnnotatedText(block.content, annotations, annotationColors, handleMouseEnterAnnotation, handleMouseLeaveAnnotation, hoveredAnnotationId)}
        </Tag>
      </div>
    );
  }

  if (block.blockType === 'FORMULA') {
    return (
      <div className={`${baseClasses} ${activeClasses} my-2`} onClick={onClick}>
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-center font-mono text-sm text-gray-800 overflow-x-auto">
          {block.content}
        </div>
      </div>
    );
  }

  if (block.blockType === 'CAPTION') {
    return (
      <div className={`${baseClasses} ${activeClasses}`} onClick={onClick}>
        <p className="text-sm text-gray-500 italic">
          {renderAnnotatedText(block.content, annotations, annotationColors, handleMouseEnterAnnotation, handleMouseLeaveAnnotation, hoveredAnnotationId)}
        </p>
      </div>
    );
  }

  // PARAGRAPH
  return (
    <div className={`${baseClasses} ${activeClasses}`} onClick={onClick}>
      <p className="text-gray-800 leading-relaxed">
        {renderAnnotatedText(block.content, annotations, annotationColors, handleMouseEnterAnnotation, handleMouseLeaveAnnotation, hoveredAnnotationId)}
      </p>
    </div>
  );
}

function renderAnnotatedText(
  text: string,
  annotations: Annotation[],
  colors: Record<AnnotationType, string>,
  onEnter: (id: string) => void,
  onLeave: () => void,
  hoveredId: string | null
) {
  if (annotations.length === 0) return text;

  // Simple annotation highlighting: wrap matching text with spans
  const parts: Array<{ type: 'text' | 'anno'; content: string; annotation?: Annotation }> = [];
  let remaining = text;

  annotations.forEach((anno) => {
    const idx = remaining.indexOf(anno.text);
    if (idx !== -1) {
      if (idx > 0) parts.push({ type: 'text', content: remaining.slice(0, idx) });
      parts.push({ type: 'anno', content: anno.text, annotation: anno });
      remaining = remaining.slice(idx + anno.text.length);
    }
  });

  if (remaining.length > 0) parts.push({ type: 'text', content: remaining });
  if (parts.length === 0) parts.push({ type: 'text', content: text });

  return parts.map((part, i) => {
    if (part.type === 'text') return <span key={i}>{part.content}</span>;
    const anno = part.annotation!;
    return (
      <span
        key={i}
        className={`inline px-1 rounded cursor-help border transition-all ${colors[anno.type]} ${hoveredId === anno.id ? 'ring-2 ring-offset-1' : ''}`}
        onMouseEnter={(e) => {
          e.stopPropagation();
          onEnter(anno.id);
        }}
        onMouseLeave={(e) => {
          e.stopPropagation();
          onLeave();
        }}
        title={anno.definition || anno.label || anno.type}
      >
        {part.content}
      </span>
    );
  });
}
