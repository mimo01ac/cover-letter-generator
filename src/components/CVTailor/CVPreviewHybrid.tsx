import type { TailoredCVData, Profile } from '../../types';

interface CVPreviewHybridProps {
  cvData: TailoredCVData;
  profile: Profile;
}

export function CVPreviewHybrid({ cvData, profile }: CVPreviewHybridProps) {
  // Split competencies into 3-column grid rows
  const competencyRows: string[][] = [];
  if (cvData.coreCompetencies) {
    for (let i = 0; i < cvData.coreCompetencies.length; i += 3) {
      competencyRows.push(cvData.coreCompetencies.slice(i, i + 3));
    }
  }

  return (
    <div className="bg-white text-gray-900 p-8 max-w-[800px] mx-auto" style={{ fontFamily: 'Calibri, Arial, sans-serif' }}>
      {/* HEADER */}
      <div className="text-center mb-1">
        <h1 className="text-2xl font-bold tracking-wide mb-0.5" style={{ fontSize: '20pt' }}>
          {profile.name}
        </h1>
        <p className="text-sm font-medium text-gray-700 mb-1.5">
          {cvData.headline}
        </p>
        <div className="text-xs text-gray-500">
          {[profile.phone, profile.email, profile.location].filter(Boolean).join(' | ')}
        </div>
      </div>

      <hr className="border-gray-300 my-4" />

      {/* PROFESSIONAL SUMMARY */}
      {cvData.executiveSummary && (
        <div className="mb-5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-800 mb-2 pb-1 border-b border-gray-300">
            Professional Summary
          </h2>
          <p className="text-sm leading-relaxed text-gray-700">
            {cvData.executiveSummary}
          </p>
        </div>
      )}

      {/* CORE COMPETENCIES - Grid format (3 columns) */}
      {competencyRows.length > 0 && (
        <div className="mb-5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-800 mb-2 pb-1 border-b border-gray-300">
            Core Competencies
          </h2>
          <div className="space-y-1">
            {competencyRows.map((row, i) => (
              <div key={i} className="grid grid-cols-3 gap-2">
                {row.map((skill, j) => (
                  <div key={j} className="text-sm text-gray-700 py-0.5">
                    {skill}
                  </div>
                ))}
                {/* Fill empty cells if row has fewer than 3 items */}
                {row.length < 3 && Array.from({ length: 3 - row.length }).map((_, j) => (
                  <div key={`empty-${j}`} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PROFESSIONAL EXPERIENCE */}
      {cvData.experience && cvData.experience.length > 0 && (
        <div className="mb-5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-800 mb-2 pb-1 border-b border-gray-300">
            Professional Experience
          </h2>
          <div className="space-y-4">
            {cvData.experience.map((exp, i) => (
              <div key={i}>
                <div className="mb-1">
                  <div className="font-bold text-sm">{exp.title}</div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-gray-600">
                      {exp.company}{exp.location ? ` | ${exp.location}` : ''}
                    </span>
                    <span className="text-xs text-gray-500 whitespace-nowrap ml-4">
                      {exp.period}
                    </span>
                  </div>
                </div>
                {exp.bullets && exp.bullets.length > 0 && (
                  <ul className="space-y-1 ml-4">
                    {exp.bullets.map((bullet, j) => (
                      <li key={j} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-gray-400 mt-0.5 flex-shrink-0">&bull;</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KEY ACHIEVEMENTS / PROJECTS */}
      {cvData.careerHighlights && cvData.careerHighlights.length > 0 && (
        <div className="mb-5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-800 mb-2 pb-1 border-b border-gray-300">
            Key Achievements
          </h2>
          <ul className="space-y-1.5 ml-4">
            {cvData.careerHighlights.map((highlight, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-gray-400 mt-0.5 flex-shrink-0">&bull;</span>
                <span>{highlight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* EDUCATION */}
      {cvData.education && cvData.education.length > 0 && (
        <div className="mb-5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-800 mb-2 pb-1 border-b border-gray-300">
            Education
          </h2>
          <div className="space-y-2">
            {cvData.education.map((edu, i) => (
              <div key={i} className="flex justify-between items-baseline">
                <div>
                  <span className="font-bold text-sm">{edu.degree}</span>
                  <span className="text-sm text-gray-600"> | {edu.institution}</span>
                  {edu.details && <span className="text-xs text-gray-500"> - {edu.details}</span>}
                </div>
                <span className="text-xs text-gray-500 whitespace-nowrap ml-4">
                  {edu.period}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CERTIFICATIONS */}
      {cvData.certifications && cvData.certifications.length > 0 && (
        <div className="mb-5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-800 mb-2 pb-1 border-b border-gray-300">
            Certifications
          </h2>
          <div className="space-y-1">
            {cvData.certifications.map((cert, i) => (
              <p key={i} className="text-sm text-gray-700">{cert}</p>
            ))}
          </div>
        </div>
      )}

      {/* LANGUAGES */}
      {cvData.languages && cvData.languages.length > 0 && (
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-800 mb-2 pb-1 border-b border-gray-300">
            Languages
          </h2>
          <p className="text-sm text-gray-700">
            {cvData.languages.join(', ')}
          </p>
        </div>
      )}
    </div>
  );
}
