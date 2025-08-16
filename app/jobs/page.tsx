"use client";

import React, { useState, useEffect } from 'react';
import Navigation from '../../components/Navigation';
import { useCSRFToken } from '../../components/hooks/useCSRFToken';
import { useTheme } from '../../components/ThemeProvider';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBriefcase, 
  faPlus, 
  faMapMarkerAlt, 
  faClock, 
  faDollarSign, 
  faEnvelope, 
  faSearch, 
  faFilter,
  faTimes,
  faBuilding,
  faGraduationCap,
  faChevronDown,
  faChevronUp,
  faTrash
} from '@fortawesome/free-solid-svg-icons';

interface JobPosting {
  job_id: string;
  title: string;
  company: string;
  location: string;
  salary_range: string;
  job_type: 'full-time' | 'part-time' | 'contract' | 'remote';
  description: string;
  requirements: string[];
  posted_by: string;
  posted_by_username: string;
  posted_by_display_name?: string;
  posted_at: string;
  application_deadline?: string;
  experience_level: 'entry' | 'mid' | 'senior' | 'executive';
  industry: string;
  is_active: boolean;
}

interface User {
  user_id: string;
  username: string;
  display_name?: string;
  is_admin?: boolean;
}

export default function JobsPage(): JSX.Element {
  const { theme } = useTheme();
  const { protectedFetch } = useCSRFToken();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [jobTypeFilter, setJobTypeFilter] = useState('');
  const [experienceFilter, setExperienceFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());

  // New job form state
  const [newJob, setNewJob] = useState<{
    title: string;
    company: string;
    location: string;
    salary_range: string;
    job_type: JobPosting['job_type'];
    description: string;
    requirements: string;
    application_deadline: string;
    experience_level: JobPosting['experience_level'];
    industry: string;
  }>({
    title: '',
    company: '',
    location: '',
    salary_range: '',
    job_type: 'full-time',
    description: '',
    requirements: '',
    application_deadline: '',
    experience_level: 'mid',
    industry: ''
  });

  useEffect(() => {
    // Fetch current user
    fetch('/api/session')
      .then(res => res.json())
      .then(data => {
        if (data.valid && data.user) {
          setCurrentUser(data.user);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch session:', err);
        setLoading(false);
      });

    // Fetch job postings
    fetchJobs();
  }, []);

  const fetchJobs = async (): Promise<void> => {
    try {
      const response = await fetch('/api/jobs');
      const data = await response.json();
      if (data.success) {
        setJobs(data.jobs);
      }
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    }
  };

  const handleCreateJob = async (): Promise<void> => {
    if (!currentUser) return;

    const requirementsArray = newJob.requirements.split('\n').filter(req => req.trim());
    
    try {
      const response = await protectedFetch('/api/jobs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newJob,
          requirements: requirementsArray
        })
      });

      const data = await response.json();
      if (data.success) {
        setShowCreateModal(false);
        setNewJob({
          title: '',
          company: '',
          location: '',
          salary_range: '',
          job_type: 'full-time',
          description: '',
          requirements: '',
          application_deadline: '',
          experience_level: 'mid',
          industry: ''
        });
        fetchJobs();
      } else {
        // Check if it's a business profile requirement error
        if (response.status === 403 && (data.message?.includes('Business profile') || data.message?.includes('business profile'))) {
          alert('You need to create a business profile first before posting jobs. Please go to your profile settings and set up your business profile.');
        } else {
          alert('Failed to create job posting: ' + data.message);
        }
      }
    } catch (error) {
      console.error('Failed to create job:', error);
      alert('Failed to create job posting');
    }
  };

  const handleApplyToJob = async (job: JobPosting): Promise<void> => {
    if (!currentUser) return;

    try {
      // Create a conversation with the job poster using business profile
      const response = await protectedFetch('/api/conversations/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiver_id: job.posted_by,
          sender_profile_type: 'business',
          receiver_profile_type: 'business',
          initial_message: `Hello! I'm interested in applying for the ${job.title} position at ${job.company}. Could we discuss this opportunity further?`
        })
      });

      const data = await response.json();
      if (data.success) {
        // Redirect to chat with the conversation, specifying business profile
        window.location.href = `/chat?user=${job.posted_by}&profile=business`;
      } else {
        alert('Failed to start conversation: ' + data.message);
      }
    } catch (error) {
      console.error('Failed to apply to job:', error);
      alert('Failed to apply to job');
    }
  };

  const handleDeleteJob = async (job: JobPosting): Promise<void> => {
  // Allow delete if current user is the owner OR an administrator
  if (!currentUser || (job.posted_by !== currentUser.user_id && !currentUser.is_admin)) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete the job posting for "${job.title}" at ${job.company}? This action cannot be undone.`
    );

    if (!confirmDelete) return;

    try {
      const response = await protectedFetch('/api/jobs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: job.job_id })
      });

      const data = await response.json();
      if (data.success) {
        // Remove from local state
        setJobs(prevJobs => prevJobs.filter(j => j.job_id !== job.job_id));
        // Also remove from expanded state if it was expanded
        setExpandedJobs(prev => {
          const newSet = new Set(prev);
          newSet.delete(job.job_id);
          return newSet;
        });
        alert('Job posting deleted successfully');
      } else {
        alert('Failed to delete job posting: ' + data.message);
      }
    } catch (error) {
      console.error('Failed to delete job:', error);
      alert('Failed to delete job posting');
    }
  };

  // Toggle expanded state for job postings
  const toggleJobExpanded = (jobId: string): void => {
    setExpandedJobs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
  };

  // Filter jobs based on search and filters
  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         job.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         job.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesLocation = !locationFilter || job.location.toLowerCase().includes(locationFilter.toLowerCase());
    const matchesJobType = !jobTypeFilter || job.job_type === jobTypeFilter;
    const matchesExperience = !experienceFilter || job.experience_level === experienceFilter;

    return matchesSearch && matchesLocation && matchesJobType && matchesExperience && job.is_active;
  });

  const getExperienceLabel = (level: string): string => {
    switch (level) {
      case 'entry': return 'Entry Level';
      case 'mid': return 'Mid Level';
      case 'senior': return 'Senior Level';
      case 'executive': return 'Executive';
      default: return level;
    }
  };

  const getJobTypeLabel = (type: string): string => {
    switch (type) {
      case 'full-time': return 'Full Time';
      case 'part-time': return 'Part Time';
      case 'contract': return 'Contract';
      case 'remote': return 'Remote';
      default: return type;
    }
  };

  if (loading) {
    return (
      <div className={`flex h-screen ${theme === 'dark' ? 'bg-black text-white' : 'bg-white text-black'}`}>
        <Navigation currentPage="jobs" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl mb-4">Loading...</h2>
            <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Finding job opportunities for you</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen ${theme === 'dark' ? 'bg-black text-white' : 'bg-white text-black'}`}>
      <Navigation currentPage="jobs" />
      <main className="flex-1 flex flex-col overflow-y-auto">
        <div className="w-full max-w-7xl mx-auto mt-2 md:mt-4 lg:mt-8 p-2 md:p-4 lg:p-6 pb-8">
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <button
              onClick={() => setShowCreateModal(true)}
              className={`${theme === 'dark' ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600'} text-white py-3 px-6 rounded-lg transition-all shadow-lg flex items-center justify-center`}
              disabled={!currentUser}
            >
              <FontAwesomeIcon icon={faPlus} className="mr-2" />
              Post a Job
            </button>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`${theme === 'dark' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white py-3 px-6 rounded-lg transition-all shadow-lg flex items-center justify-center`}
            >
              <FontAwesomeIcon icon={faFilter} className="mr-2" />
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </button>
          </div>

          {/* Search and Filters */}
          <div className={`${theme === 'dark' ? 'bg-black/80 border-white' : 'bg-gray-100/80 border-gray-400'} border rounded-lg shadow-lg mb-6 p-4`}>
            {/* Search Bar */}
            <div className="relative mb-4">
              <FontAwesomeIcon 
                icon={faSearch} 
                className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`} 
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search job titles, companies, or descriptions..."
                className={`w-full ${theme === 'dark' ? 'bg-black text-white border-gray-600 focus:border-blue-400' : 'bg-white text-black border-gray-400 focus:border-blue-600'} border rounded-lg p-3 pl-10 focus:outline-none shadow-lg transition-colors`}
              />
            </div>

            {/* Filters */}
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={`block text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} mb-2`}>Location</label>
                  <input
                    type="text"
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    placeholder="Enter location..."
                    className={`w-full ${theme === 'dark' ? 'bg-black text-white border-gray-600 focus:border-blue-400' : 'bg-white text-black border-gray-400 focus:border-blue-600'} border rounded-lg p-2 focus:outline-none transition-colors`}
                  />
                </div>
                
                <div>
                  <label className={`block text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} mb-2`}>Job Type</label>
                  <select
                    value={jobTypeFilter}
                    onChange={(e) => setJobTypeFilter(e.target.value)}
                    className={`w-full ${theme === 'dark' ? 'bg-black text-white border-gray-600 focus:border-blue-400' : 'bg-white text-black border-gray-400 focus:border-blue-600'} border rounded-lg p-2 focus:outline-none transition-colors`}
                  >
                    <option value="">All Types</option>
                    <option value="full-time">Full Time</option>
                    <option value="part-time">Part Time</option>
                    <option value="contract">Contract</option>
                    <option value="remote">Remote</option>
                  </select>
                </div>
                
                <div>
                  <label className={`block text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} mb-2`}>Experience Level</label>
                  <select
                    value={experienceFilter}
                    onChange={(e) => setExperienceFilter(e.target.value)}
                    className={`w-full ${theme === 'dark' ? 'bg-black text-white border-gray-600 focus:border-blue-400' : 'bg-white text-black border-gray-400 focus:border-blue-600'} border rounded-lg p-2 focus:outline-none transition-colors`}
                  >
                    <option value="">All Levels</option>
                    <option value="entry">Entry Level</option>
                    <option value="mid">Mid Level</option>
                    <option value="senior">Senior Level</option>
                    <option value="executive">Executive</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Job Listings */}
          <div className="space-y-4">
            {filteredJobs.length === 0 ? (
              <div className={`${theme === 'dark' ? 'bg-black/80 border-white' : 'bg-gray-100/80 border-gray-400'} border rounded-lg shadow-lg p-8 text-center`}>
                <FontAwesomeIcon icon={faBriefcase} className={`text-4xl ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'} mb-4`} />
                <h3 className={`text-xl ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} mb-2`}>No Jobs Found</h3>
                <p className={`${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>
                  {searchQuery || locationFilter || jobTypeFilter || experienceFilter 
                    ? 'No jobs match your current search criteria.' 
                    : 'No job postings are available at this time.'}
                </p>
              </div>
            ) : (
              filteredJobs.map((job) => {
                const isExpanded = expandedJobs.has(job.job_id);
                
                return (
                  <div key={job.job_id} className={`${theme === 'dark' ? 'bg-black/80 border-white' : 'bg-gray-100/80 border-gray-400'} border rounded-lg shadow-lg`}>
                    {/* Job Header - Always Visible - Clickable */}
                    <div 
                      className={`p-6 cursor-pointer ${theme === 'dark' ? 'hover:bg-gray-900/50' : 'hover:bg-gray-200/50'} transition-colors rounded-t-lg`}
                      onClick={() => toggleJobExpanded(job.job_id)}
                    >
                      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>{job.title}</h3>
                            <FontAwesomeIcon 
                              icon={isExpanded ? faChevronUp : faChevronDown} 
                              className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} ml-4 text-lg`}
                            />
                          </div>
                          <div className={`flex flex-wrap items-center gap-4 text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                            <span className="flex items-center">
                              <FontAwesomeIcon icon={faBuilding} className="mr-1 text-blue-400" />
                              {job.company}
                            </span>
                            <span className="flex items-center">
                              <FontAwesomeIcon icon={faMapMarkerAlt} className="mr-1 text-green-400" />
                              {job.location}
                            </span>
                            <span className="flex items-center">
                              <FontAwesomeIcon icon={faClock} className="mr-1 text-yellow-400" />
                              {getJobTypeLabel(job.job_type)}
                            </span>
                            <span className="flex items-center">
                              <FontAwesomeIcon icon={faGraduationCap} className="mr-1 text-purple-400" />
                              {getExperienceLabel(job.experience_level)}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-end gap-2 mt-4 lg:mt-0">
                          {job.salary_range && (
                            <span className="text-green-400 font-bold flex items-center">
                              <FontAwesomeIcon icon={faDollarSign} className="mr-1" />
                              {job.salary_range}
                            </span>
                          )}
                          <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                            Click to {isExpanded ? 'collapse' : 'expand'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Job Details - Collapsible Content */}
                    {isExpanded && (
                      <div className={`px-6 pb-6 border-t ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}>
                        <div className="pt-4 space-y-4">
                          <div>
                            <h4 className={`${theme === 'dark' ? 'text-white' : 'text-black'} font-bold mb-2`}>Description</h4>
                            <p className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} leading-relaxed`}>{job.description}</p>
                          </div>
                          
                          {job.requirements.length > 0 && (
                            <div>
                              <h4 className="text-yellow-400 font-bold mb-2">Requirements</h4>
                              <ul className={`list-disc list-inside ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} space-y-1`}>
                                {job.requirements.map((req, index) => (
                                  <li key={index} className="text-sm">{req}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                            <div>
                              <p className="mb-2"><strong className={`${theme === 'dark' ? 'text-white' : 'text-black'}`}>Industry:</strong> {job.industry}</p>
                              <p className="mb-2"><strong className={`${theme === 'dark' ? 'text-white' : 'text-black'}`}>Posted by:</strong> {job.posted_by_display_name || job.posted_by_username}</p>
                              <p className="mb-2"><strong className={`${theme === 'dark' ? 'text-white' : 'text-black'}`}>Posted:</strong> {new Date(job.posted_at).toLocaleDateString()}</p>
                            </div>
                            <div>
                              {job.application_deadline && (
                                <p className="mb-2"><strong className="text-red-400">Application Deadline:</strong> {new Date(job.application_deadline).toLocaleDateString()}</p>
                              )}
                            </div>
                          </div>

                          <div className={`flex justify-end gap-3 pt-4 border-t ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}>
                            {/* Apply button visible when viewing others' postings */}
                            {currentUser && job.posted_by !== currentUser.user_id && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApplyToJob(job);
                                }}
                                className="bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-all shadow-lg flex items-center"
                              >
                                <FontAwesomeIcon icon={faEnvelope} className="mr-2" />
                                Apply Now
                              </button>
                            )}

                            {/* Delete button visible for owners and admins */}
                            {currentUser && (job.posted_by === currentUser.user_id || currentUser.is_admin) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteJob(job);
                                }}
                                className="bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-all shadow-lg flex items-center"
                              >
                                <FontAwesomeIcon icon={faTrash} className="mr-2" />
                                Delete Posting
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      {/* Create Job Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${theme === 'dark' ? 'bg-black border-white' : 'bg-white border-gray-400'} border rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto`}>
            {/* Modal Header */}
            <div className={`${theme === 'dark' ? 'bg-black text-white border-gray-600' : 'bg-gray-50 text-black border-gray-300'} p-4 rounded-t-lg flex items-center justify-between border-b`}>
              <h2 className="text-lg font-bold">
                <FontAwesomeIcon icon={faPlus} className="mr-2" />
                Create Job Posting
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className={`${theme === 'dark' ? 'text-white hover:text-gray-300' : 'text-black hover:text-gray-600'} transition-colors text-xl`}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} mb-2`}>Job Title *</label>
                  <input
                    type="text"
                    value={newJob.title}
                    onChange={(e) => setNewJob(prev => ({ ...prev, title: e.target.value }))}
                    className={`w-full ${theme === 'dark' ? 'bg-black text-white border-gray-600' : 'bg-white text-black border-gray-300'} border rounded-lg p-2 focus:outline-none focus:border-blue-400`}
                    placeholder="Enter job title..."
                  />
                </div>
                
                <div>
                  <label className={`block text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} mb-2`}>Company *</label>
                  <input
                    type="text"
                    value={newJob.company}
                    onChange={(e) => setNewJob(prev => ({ ...prev, company: e.target.value }))}
                    className={`w-full ${theme === 'dark' ? 'bg-black text-white border-gray-600' : 'bg-white text-black border-gray-300'} border rounded-lg p-2 focus:outline-none focus:border-blue-400`}
                    placeholder="Enter company name..."
                  />
                </div>
                
                <div>
                  <label className={`block text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} mb-2`}>Location *</label>
                  <input
                    type="text"
                    value={newJob.location}
                    onChange={(e) => setNewJob(prev => ({ ...prev, location: e.target.value }))}
                    className={`w-full ${theme === 'dark' ? 'bg-black text-white border-gray-600' : 'bg-white text-black border-gray-300'} border rounded-lg p-2 focus:outline-none focus:border-blue-400`}
                    placeholder="Enter location..."
                  />
                </div>
                
                <div>
                  <label className={`block text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} mb-2`}>Salary Range</label>
                  <input
                    type="text"
                    value={newJob.salary_range}
                    onChange={(e) => setNewJob(prev => ({ ...prev, salary_range: e.target.value }))}
                    className={`w-full ${theme === 'dark' ? 'bg-black text-white border-gray-600' : 'bg-white text-black border-gray-300'} border rounded-lg p-2 focus:outline-none focus:border-blue-400`}
                    placeholder="e.g. $50,000 - $70,000"
                  />
                </div>
                
                <div>
                  <label className={`block text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} mb-2`}>Job Type *</label>
                  <select
                    value={newJob.job_type}
                    onChange={(e) => setNewJob(prev => ({ ...prev, job_type: e.target.value as JobPosting['job_type'] }))}
                    className={`w-full ${theme === 'dark' ? 'bg-black text-white border-gray-600' : 'bg-white text-black border-gray-300'} border rounded-lg p-2 focus:outline-none focus:border-blue-400`}
                  >
                    <option value="full-time">Full Time</option>
                    <option value="part-time">Part Time</option>
                    <option value="contract">Contract</option>
                    <option value="remote">Remote</option>
                  </select>
                </div>
                
                <div>
                  <label className={`block text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} mb-2`}>Experience Level *</label>
                  <select
                    value={newJob.experience_level}
                    onChange={(e) => setNewJob(prev => ({ ...prev, experience_level: e.target.value as JobPosting['experience_level'] }))}
                    className={`w-full ${theme === 'dark' ? 'bg-black text-white border-gray-600' : 'bg-white text-black border-gray-300'} border rounded-lg p-2 focus:outline-none focus:border-blue-400`}
                  >
                    <option value="entry">Entry Level</option>
                    <option value="mid">Mid Level</option>
                    <option value="senior">Senior Level</option>
                    <option value="executive">Executive</option>
                  </select>
                </div>
                
                <div>
                  <label className={`block text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} mb-2`}>Industry</label>
                  <input
                    type="text"
                    value={newJob.industry}
                    onChange={(e) => setNewJob(prev => ({ ...prev, industry: e.target.value }))}
                    className={`w-full ${theme === 'dark' ? 'bg-black text-white border-gray-600' : 'bg-white text-black border-gray-300'} border rounded-lg p-2 focus:outline-none focus:border-blue-400`}
                    placeholder="e.g. Technology, Finance..."
                  />
                </div>
                
                <div>
                  <label className={`block text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} mb-2`}>Application Deadline</label>
                  <input
                    type="date"
                    value={newJob.application_deadline}
                    onChange={(e) => setNewJob(prev => ({ ...prev, application_deadline: e.target.value }))}
                    className={`w-full ${theme === 'dark' ? 'bg-black text-white border-gray-600' : 'bg-white text-black border-gray-300'} border rounded-lg p-2 focus:outline-none focus:border-blue-400`}
                  />
                </div>
              </div>
              
              <div>
                <label className={`block text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} mb-2`}>Job Description *</label>
                <textarea
                  value={newJob.description}
                  onChange={(e) => setNewJob(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  className={`w-full ${theme === 'dark' ? 'bg-black text-white border-gray-600' : 'bg-white text-black border-gray-300'} border rounded-lg p-2 focus:outline-none focus:border-blue-400`}
                  placeholder="Describe the job role, responsibilities, and what you're looking for..."
                />
              </div>
              
              <div>
                <label className={`block text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} mb-2`}>Requirements (one per line)</label>
                <textarea
                  value={newJob.requirements}
                  onChange={(e) => setNewJob(prev => ({ ...prev, requirements: e.target.value }))}
                  rows={4}
                  className={`w-full ${theme === 'dark' ? 'bg-black text-white border-gray-600' : 'bg-white text-black border-gray-300'} border rounded-lg p-2 focus:outline-none focus:border-blue-400`}
                  placeholder={`Bachelor's degree required\n3+ years experience\nProficient in specific skills...`}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-4 pt-4">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className={`flex-1 ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-300 hover:bg-gray-400'} ${theme === 'dark' ? 'text-white' : 'text-black'} py-3 px-4 rounded-lg transition-colors`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateJob}
                  className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors"
                  disabled={!newJob.title || !newJob.company || !newJob.location || !newJob.description}
                >
                  Post Job
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
