import type { TailoredCVData, Profile } from '../../types';

interface CVPreviewExecutiveProps {
  cvData: TailoredCVData;
  profile: Profile;
}

export function CVPreviewExecutive({ cvData, profile }: CVPreviewExecutiveProps) {
  return (
    <div className="bg-white text-gray-900 p-8 max-w-[800px] mx-auto" style={{ fontFamily: 'Georgia, Garamond, serif' }}>
      {/* HEADER - Name with headline as pipe-separated keywords */}
      <div className="text-center mb-1">
        <h1 className="text-2xl font-bold tracking-wide mb-0.5" style={{ fontSize: '20pt' }}>
          {profile.name}
        </h1>
        <p className="text-sm font-semibold text-gray-700 mb-1.5">
          {cvData.headline}
        </p>
        <div className="text-xs text-gray-500">
          {[profile.phone, profile.email, profile.location].filter(Boolean).join(' | ')}
        </div>
      </div>

      <hr className="border-gray-800 border-t-2 my-4" />

      {/* EXECUTIVE SUMMARY - More substantial, paragraph format */}
      {cvData.executiveSummary && (
        <div className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-800 mb-2 pb-1 border-b border-gray-300">
            Executive Summary
          </h2>
          <p className="text-sm leading-relaxed text-gray-700" style={{ lineHeight: '1.7' }}>
            {cvData.executiveSummary}
          </p>
        </div>
      )}

      {/* KEY ACHIEVEMENTS / CAREER HIGHLIGHTS - Greatest hits across career */}
      {cvData.careerHighlights && cvData.careerHighlights.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-800 mb-2 pb-1 border-b border-gray-300">
            Career Highlights
          </h2>
          <ul className="space-y-2 ml-4">
            {cvData.careerHighlights.map((highlight, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-gray-600 mt-0.5 flex-shrink-0 font-bold">&#9654;</span>
                <span>{highlight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* CORE COMPETENCIES */}
      {cvData.coreCompetencies && cvData.coreCompetencies.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-800 mb-2 pb-1 border-b border-gray-300">
            Core Competencies
          </h2>
          <p className="text-sm text-gray-700">
            {cvData.coreCompetencies.join(' \u2022 ')}
          </p>
        </div>
      )}

      {/* PROFESSIONAL EXPERIENCE */}
      {cvData.experience && cvData.experience.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-800 mb-2 pb-1 border-b border-gray-300">
            Professional Experience
          </h2>
          <div className="space-y-5">
            {cvData.experience.map((exp, i) => (
              <div key={i}>
                <div className="mb-1.5">
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-sm">{exp.title}</span>
                    <span className="text-xs text-gray-500 whitespace-nowrap ml-4">
                      {exp.period}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {exp.company}{exp.location ? ` | ${exp.location}` : ''}
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
