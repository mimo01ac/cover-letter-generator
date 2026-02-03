import type { PreviousJob } from '../../types';

interface JobSelectorProps {
  previousJobs: PreviousJob[];
  onJobSelect: (job: PreviousJob | null) => void;
}

export function JobSelector({ previousJobs, onJobSelect }: JobSelectorProps) {
  if (previousJobs.length === 0) {
    return null;
  }

  const handleJobChange = (key: string) => {
    if (key) {
      const [jobTitle, companyName] = key.split('|');
      const job = previousJobs.find(
        (j) => j.jobTitle === jobTitle && j.companyName === companyName
      );
      if (job) {
        onJobSelect(job);
      }
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Or select from previous jobs
      </label>
      <select
        onChange={(e) => handleJobChange(e.target.value)}
        defaultValue=""
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
      >
        <option value="">Choose a previous job...</option>
        {previousJobs.map((job, index) => {
          const key = `${job.jobTitle}|${job.companyName}`;
          return (
            <option key={`${key}-${index}`} value={key}>
              {job.jobTitle} at {job.companyName}
            </option>
          );
        })}
      </select>
    </div>
  );
}
