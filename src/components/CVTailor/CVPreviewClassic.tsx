import type { TailoredCVData, Profile } from '../../types';

interface CVPreviewClassicProps {
  cvData: TailoredCVData;
  profile: Profile;
}

export function CVPreviewClassic({ cvData, profile }: CVPreviewClassicProps) {
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

      {/* WORK EXPERIENCE */}
      {cvData.experience && cvData.experience.length > 0 && (
        <div className="mb-5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-800 mb-2 pb-1 border-b border-gray-300">
            Work Experience
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

      {/* SKILLS */}
      {cvData.coreCompetencies && cvData.coreCompetencies.length > 0 && (
        <div className="mb-5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-800 mb-2 pb-1 border-b border-gray-300">
            Skills
          </h2>
          <p className="text-sm text-gray-700">
            {cvData.coreCompetencies.join(', ')}
          </p>
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
