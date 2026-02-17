import type { CVTemplate } from '../../types';

interface TemplateSelectorProps {
  selectedTemplate: CVTemplate;
  onSelect: (template: CVTemplate) => void;
}

const templates: Array<{ id: CVTemplate; name: string; description: string; ideal: string }> = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Chronological',
    ideal: 'Progressive career',
  },
  {
    id: 'hybrid',
    name: 'Hybrid',
    description: 'Skills + History',
    ideal: 'Career changers',
  },
  {
    id: 'executive',
    name: 'Executive',
    description: 'Impact-focused',
    ideal: 'Senior leaders',
  },
];

export function TemplateSelector({ selectedTemplate, onSelect }: TemplateSelectorProps) {
  return (
    <div className="flex gap-2">
      {templates.map((template) => (
        <button
          key={template.id}
          onClick={() => onSelect(template.id)}
          className={`flex-1 px-3 py-2 rounded-lg border-2 transition-all text-left ${
            selectedTemplate === template.id
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }`}
        >
          <div className="flex items-center gap-2">
            {/* Mini wireframe */}
            <div className={`w-8 h-10 rounded border flex flex-col gap-0.5 p-0.5 ${
              selectedTemplate === template.id
                ? 'border-blue-400'
                : 'border-gray-300 dark:border-gray-600'
            }`}>
              {template.id === 'classic' && (
                <>
                  {/* Header */}
                  <div className="w-full h-1 bg-gray-400 dark:bg-gray-500 rounded-sm" />
                  {/* Summary */}
                  <div className="w-3/4 h-0.5 bg-gray-300 dark:bg-gray-600 rounded-sm" />
                  {/* Experience lines */}
                  <div className="w-full h-0.5 bg-gray-300 dark:bg-gray-600 rounded-sm" />
                  <div className="w-full h-0.5 bg-gray-300 dark:bg-gray-600 rounded-sm" />
                  {/* Education */}
                  <div className="w-2/3 h-0.5 bg-gray-300 dark:bg-gray-600 rounded-sm" />
                  {/* Skills */}
                  <div className="w-1/2 h-0.5 bg-gray-300 dark:bg-gray-600 rounded-sm" />
                </>
              )}
              {template.id === 'hybrid' && (
                <>
                  {/* Header */}
                  <div className="w-full h-1 bg-gray-400 dark:bg-gray-500 rounded-sm" />
                  {/* Summary */}
                  <div className="w-3/4 h-0.5 bg-gray-300 dark:bg-gray-600 rounded-sm" />
                  {/* Skills grid - 3 dots in a row */}
                  <div className="flex gap-0.5">
                    <div className="w-1/3 h-0.5 bg-gray-400 dark:bg-gray-500 rounded-sm" />
                    <div className="w-1/3 h-0.5 bg-gray-400 dark:bg-gray-500 rounded-sm" />
                    <div className="w-1/3 h-0.5 bg-gray-400 dark:bg-gray-500 rounded-sm" />
                  </div>
                  {/* Experience lines */}
                  <div className="w-full h-0.5 bg-gray-300 dark:bg-gray-600 rounded-sm" />
                  <div className="w-full h-0.5 bg-gray-300 dark:bg-gray-600 rounded-sm" />
                  <div className="w-2/3 h-0.5 bg-gray-300 dark:bg-gray-600 rounded-sm" />
                </>
              )}
              {template.id === 'executive' && (
                <>
                  {/* Header - thicker for executive weight */}
                  <div className="w-full h-1.5 bg-gray-500 dark:bg-gray-400 rounded-sm" />
                  {/* Summary - paragraph block */}
                  <div className="w-full h-0.5 bg-gray-300 dark:bg-gray-600 rounded-sm" />
                  <div className="w-3/4 h-0.5 bg-gray-300 dark:bg-gray-600 rounded-sm" />
                  {/* Highlights */}
                  <div className="w-full h-0.5 bg-gray-400 dark:bg-gray-500 rounded-sm" />
                  {/* Experience */}
                  <div className="w-full h-0.5 bg-gray-300 dark:bg-gray-600 rounded-sm" />
                  <div className="w-2/3 h-0.5 bg-gray-300 dark:bg-gray-600 rounded-sm" />
                </>
              )}
            </div>
            <div>
              <div className={`text-sm font-medium ${
                selectedTemplate === template.id
                  ? 'text-blue-700 dark:text-blue-300'
                  : 'text-gray-700 dark:text-gray-300'
              }`}>
                {template.name}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {template.description}
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
