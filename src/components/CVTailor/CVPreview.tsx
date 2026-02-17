import type { TailoredCVData, CVTemplate, Profile } from '../../types';
import { CVPreviewClassic } from './CVPreviewClassic';
import { CVPreviewHybrid } from './CVPreviewHybrid';
import { CVPreviewExecutive } from './CVPreviewExecutive';

interface CVPreviewProps {
  cvData: TailoredCVData;
  profile: Profile;
  selectedTemplate: CVTemplate;
}

export function CVPreview({ cvData, profile, selectedTemplate }: CVPreviewProps) {
  switch (selectedTemplate) {
    case 'hybrid':
      return <CVPreviewHybrid cvData={cvData} profile={profile} />;
    case 'executive':
      return <CVPreviewExecutive cvData={cvData} profile={profile} />;
    case 'classic':
    default:
      return <CVPreviewClassic cvData={cvData} profile={profile} />;
  }
}
