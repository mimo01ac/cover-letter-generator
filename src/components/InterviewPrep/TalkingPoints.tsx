import { useState } from 'react';
import type { TalkingPoint } from '../../types';

interface TalkingPointsProps {
  talkingPoints: TalkingPoint[];
  briefingId: string | null;
}

export function TalkingPoints({ talkingPoints, briefingId: _briefingId }: TalkingPointsProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  if (!talkingPoints || talkingPoints.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
        <p>STAR-format talking points will appear here once generated.</p>
      </div>
    );
  }

  const handleCopyStory = async (story: TalkingPoint) => {
    const text = `SITUATION:\n${story.situation}\n\nTASK:\n${story.task}\n\nACTION:\n${story.action}\n\nRESULT:\n${story.result}\n\nRelevant for: ${story.relevantFor.join(', ')}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Use these STAR-format stories to answer behavioral interview questions. Each story demonstrates key competencies from your experience.
        </p>
      </div>

      {/* Stories Grid */}
      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
        {talkingPoints.map((story, index) => {
          const isExpanded = expandedIndex === index;

          return (
            <div
              key={index}
              className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
            >
              {/* Story Header */}
              <button
                onClick={() => setExpandedIndex(isExpanded ? null : index)}
                className="w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{index + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 dark:text-white line-clamp-2">
                    {story.situation}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {story.relevantFor.slice(0, 3).map((tag, tagIndex) => (
                      <span
                        key={tagIndex}
                        className="inline-block px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                    {story.relevantFor.length > 3 && (
                      <span className="text-xs text-gray-400">+{story.relevantFor.length - 3} more</span>
                    )}
                  </div>
                </div>
                <svg
                  className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* STAR Details */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <div className="pt-4 space-y-4">
                    {/* Copy Button */}
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleCopyStory(story)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy Story
                      </button>
                    </div>

                    {/* STAR Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Situation */}
                      <div className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 bg-purple-100 dark:bg-purple-900/30 rounded flex items-center justify-center">
                            <span className="text-xs font-bold text-purple-600 dark:text-purple-400">S</span>
                          </div>
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Situation</h4>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                          {story.situation}
                        </p>
                      </div>

                      {/* Task */}
                      <div className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded flex items-center justify-center">
                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">T</span>
                          </div>
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Task</h4>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                          {story.task}
                        </p>
                      </div>

                      {/* Action */}
                      <div className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded flex items-center justify-center">
                            <span className="text-xs font-bold text-green-600 dark:text-green-400">A</span>
                          </div>
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Action</h4>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                          {story.action}
                        </p>
                      </div>

                      {/* Result */}
                      <div className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 bg-amber-100 dark:bg-amber-900/30 rounded flex items-center justify-center">
                            <span className="text-xs font-bold text-amber-600 dark:text-amber-400">R</span>
                          </div>
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Result</h4>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                          {story.result}
                        </p>
                      </div>
                    </div>

                    {/* Relevant For Tags */}
                    <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                      <h5 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">USE FOR:</h5>
                      <div className="flex flex-wrap gap-1.5">
                        {story.relevantFor.map((tag, tagIndex) => (
                          <span
                            key={tagIndex}
                            className="inline-block px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-full text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
