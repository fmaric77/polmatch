"use client";

import React, { useState, useEffect } from 'react';
import Navigation from '../../components/Navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBriefcase, 
  faPlus, 
  faMapMarkerAlt, 
  faClock, 
  faDollarSign, 
  faUser, 
  faEnvelope, 
  faSearch, 
  faFilter,
  faTimes,
  faBuilding,
  faGraduationCap,
  faCalendarAlt
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
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [jobTypeFilter, setJobTypeFilter] = useState('');
  const [experienceFilter, setExperienceFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

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
      const response = await fetch('/api/jobs/create', {
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
        alert('Failed to create job posting: ' + data.message);
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
      const response = await fetch('/api/conversations/create', {
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
      <div className="flex h-screen bg-black text-white">
        <Navigation currentPage="jobs" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl mb-4">Loading...</h2>
            <p className="text-gray-400">Loading job opportunities</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-black text-white">
      <Navigation currentPage="jobs" />
      <main className="flex-1 flex flex-col overflow-y-auto">
        <div className="w-full max-w-7xl mx-auto mt-2 md:mt-4 lg:mt-8 p-2 md:p-4 lg:p-6 pb-8">
          {/* FBI-Style Header */}
          <div className="bg-black border-2 border-white rounded-none shadow-2xl mb-4 md:mb-6">
            <div className="bg-white text-black p-3 text-center">
              <div className="font-mono text-xs mb-1 font-bold tracking-widest">EMPLOYMENT OPERATIONS CENTER</div>
              <h1 className="text-lg md:text-xl font-bold tracking-widest uppercase">
                <FontAwesomeIcon icon={faBriefcase} className="mr-2" />
                CAREER OPPORTUNITIES
              </h1>
              <div className="font-mono text-xs mt-1 tracking-widest">BUSINESS PROFILE RESTRICTED</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-green-900 text-white border-2 border-green-700 py-3 px-6 rounded-none hover:bg-green-800 transition-all shadow-lg font-mono uppercase tracking-wider"
              disabled={!currentUser}
            >
              <FontAwesomeIcon icon={faPlus} className="mr-2" />
              POST JOB VACANCY
            </button>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="bg-blue-900 text-white border-2 border-blue-700 py-3 px-6 rounded-none hover:bg-blue-800 transition-all shadow-lg font-mono uppercase tracking-wider"
            >
              <FontAwesomeIcon icon={faFilter} className="mr-2" />
              {showFilters ? 'HIDE FILTERS' : 'SHOW FILTERS'}
            </button>
          </div>

          {/* Search and Filters */}
          <div className="bg-black/80 border-2 border-white rounded-none shadow-lg mb-6 p-4">
            {/* Search Bar */}
            <div className="relative mb-4">
              <FontAwesomeIcon 
                icon={faSearch} 
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" 
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="SEARCH OPPORTUNITIES..."
                className="w-full bg-black text-white border-2 border-white rounded-none p-3 pl-10 focus:outline-none focus:border-blue-400 font-mono shadow-lg"
              />
            </div>

            {/* Filters */}
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-mono text-gray-400 mb-2 uppercase">Location</label>
                  <input
                    type="text"
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    placeholder="Enter location..."
                    className="w-full bg-black text-white border-2 border-gray-600 rounded-none p-2 focus:outline-none focus:border-white font-mono"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-mono text-gray-400 mb-2 uppercase">Job Type</label>
                  <select
                    value={jobTypeFilter}
                    onChange={(e) => setJobTypeFilter(e.target.value)}
                    className="w-full bg-black text-white border-2 border-gray-600 rounded-none p-2 focus:outline-none focus:border-white font-mono"
                  >
                    <option value="">All Types</option>
                    <option value="full-time">Full Time</option>
                    <option value="part-time">Part Time</option>
                    <option value="contract">Contract</option>
                    <option value="remote">Remote</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-mono text-gray-400 mb-2 uppercase">Experience</label>
                  <select
                    value={experienceFilter}
                    onChange={(e) => setExperienceFilter(e.target.value)}
                    className="w-full bg-black text-white border-2 border-gray-600 rounded-none p-2 focus:outline-none focus:border-white font-mono"
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
              <div className="bg-black/80 border-2 border-white rounded-none shadow-lg p-8 text-center">
                <FontAwesomeIcon icon={faBriefcase} className="text-4xl text-gray-500 mb-4" />
                <h3 className="text-xl font-mono text-gray-400 mb-2">NO ACTIVE OPPORTUNITIES</h3>
                <p className="text-gray-500 font-mono">
                  {searchQuery || locationFilter || jobTypeFilter || experienceFilter 
                    ? 'No jobs match your current filters.' 
                    : 'No job postings available at this time.'}
                </p>
              </div>
            ) : (
              filteredJobs.map((job) => (
                <div key={job.job_id} className="bg-black/80 border-2 border-white rounded-none shadow-lg p-6">
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-white mb-2">{job.title}</h3>
                      <div className="flex flex-wrap items-center gap-4 text-sm font-mono text-gray-300">
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
                        <span className="text-green-400 font-mono font-bold flex items-center">
                          <FontAwesomeIcon icon={faDollarSign} className="mr-1" />
                          {job.salary_range}
                        </span>
                      )}
                      <button
                        onClick={() => handleApplyToJob(job)}
                        className="bg-green-900 text-white border-2 border-green-700 py-2 px-4 rounded-none hover:bg-green-800 transition-all shadow-lg font-mono uppercase tracking-wider"
                        disabled={!currentUser || job.posted_by === currentUser?.user_id}
                      >
                        <FontAwesomeIcon icon={faEnvelope} className="mr-2" />
                        {job.posted_by === currentUser?.user_id ? 'YOUR POSTING' : 'APPLY NOW'}
                      </button>
                    </div>
                  </div>

                  <p className="text-gray-300 mb-4 leading-relaxed">{job.description}</p>
                  
                  {job.requirements.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-yellow-400 font-mono font-bold mb-2 uppercase tracking-wider">Requirements:</h4>
                      <ul className="list-disc list-inside text-gray-300 space-y-1">
                        {job.requirements.map((req, index) => (
                          <li key={index} className="font-mono text-sm">{req}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex flex-wrap justify-between items-center text-xs font-mono text-gray-500 border-t border-gray-600 pt-4">
                    <div className="flex items-center space-x-4">
                      <span className="flex items-center">
                        <FontAwesomeIcon icon={faUser} className="mr-1" />
                        Posted by: {job.posted_by_display_name || job.posted_by_username}
                      </span>
                      <span className="flex items-center">
                        <FontAwesomeIcon icon={faCalendarAlt} className="mr-1" />
                        Posted: {new Date(job.posted_at).toLocaleDateString()}
                      </span>
                    </div>
                    
                    {job.application_deadline && (
                      <span className="flex items-center text-red-400">
                        <FontAwesomeIcon icon={faClock} className="mr-1" />
                        Deadline: {new Date(job.application_deadline).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Create Job Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-black border-2 border-white rounded-none shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="bg-white text-black p-4 flex items-center justify-between">
              <h2 className="text-lg font-bold font-mono uppercase tracking-wider">
                <FontAwesomeIcon icon={faPlus} className="mr-2" />
                CREATE JOB POSTING
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-black hover:text-gray-600 transition-colors font-mono text-xl"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-mono text-gray-400 mb-2 uppercase">Job Title *</label>
                  <input
                    type="text"
                    value={newJob.title}
                    onChange={(e) => setNewJob(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full bg-black text-white border-2 border-white rounded-none p-2 focus:outline-none focus:border-blue-400 font-mono"
                    placeholder="Enter job title..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-mono text-gray-400 mb-2 uppercase">Company *</label>
                  <input
                    type="text"
                    value={newJob.company}
                    onChange={(e) => setNewJob(prev => ({ ...prev, company: e.target.value }))}
                    className="w-full bg-black text-white border-2 border-white rounded-none p-2 focus:outline-none focus:border-blue-400 font-mono"
                    placeholder="Enter company name..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-mono text-gray-400 mb-2 uppercase">Location *</label>
                  <input
                    type="text"
                    value={newJob.location}
                    onChange={(e) => setNewJob(prev => ({ ...prev, location: e.target.value }))}
                    className="w-full bg-black text-white border-2 border-white rounded-none p-2 focus:outline-none focus:border-blue-400 font-mono"
                    placeholder="Enter location..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-mono text-gray-400 mb-2 uppercase">Salary Range</label>
                  <input
                    type="text"
                    value={newJob.salary_range}
                    onChange={(e) => setNewJob(prev => ({ ...prev, salary_range: e.target.value }))}
                    className="w-full bg-black text-white border-2 border-white rounded-none p-2 focus:outline-none focus:border-blue-400 font-mono"
                    placeholder="e.g. $50,000 - $70,000"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-mono text-gray-400 mb-2 uppercase">Job Type *</label>
                  <select
                    value={newJob.job_type}
                    onChange={(e) => setNewJob(prev => ({ ...prev, job_type: e.target.value as JobPosting['job_type'] }))}
                    className="w-full bg-black text-white border-2 border-white rounded-none p-2 focus:outline-none focus:border-blue-400 font-mono"
                  >
                    <option value="full-time">Full Time</option>
                    <option value="part-time">Part Time</option>
                    <option value="contract">Contract</option>
                    <option value="remote">Remote</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-mono text-gray-400 mb-2 uppercase">Experience Level *</label>
                  <select
                    value={newJob.experience_level}
                    onChange={(e) => setNewJob(prev => ({ ...prev, experience_level: e.target.value as JobPosting['experience_level'] }))}
                    className="w-full bg-black text-white border-2 border-white rounded-none p-2 focus:outline-none focus:border-blue-400 font-mono"
                  >
                    <option value="entry">Entry Level</option>
                    <option value="mid">Mid Level</option>
                    <option value="senior">Senior Level</option>
                    <option value="executive">Executive</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-mono text-gray-400 mb-2 uppercase">Industry</label>
                  <input
                    type="text"
                    value={newJob.industry}
                    onChange={(e) => setNewJob(prev => ({ ...prev, industry: e.target.value }))}
                    className="w-full bg-black text-white border-2 border-white rounded-none p-2 focus:outline-none focus:border-blue-400 font-mono"
                    placeholder="e.g. Technology, Finance..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-mono text-gray-400 mb-2 uppercase">Application Deadline</label>
                  <input
                    type="date"
                    value={newJob.application_deadline}
                    onChange={(e) => setNewJob(prev => ({ ...prev, application_deadline: e.target.value }))}
                    className="w-full bg-black text-white border-2 border-white rounded-none p-2 focus:outline-none focus:border-blue-400 font-mono"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-mono text-gray-400 mb-2 uppercase">Job Description *</label>
                <textarea
                  value={newJob.description}
                  onChange={(e) => setNewJob(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  className="w-full bg-black text-white border-2 border-white rounded-none p-2 focus:outline-none focus:border-blue-400 font-mono"
                  placeholder="Describe the job role, responsibilities, and what you're looking for..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-mono text-gray-400 mb-2 uppercase">Requirements (one per line)</label>
                <textarea
                  value={newJob.requirements}
                  onChange={(e) => setNewJob(prev => ({ ...prev, requirements: e.target.value }))}
                  rows={4}
                  className="w-full bg-black text-white border-2 border-white rounded-none p-2 focus:outline-none focus:border-blue-400 font-mono"
                  placeholder={`Bachelor's degree required\n3+ years experience\nProficient in specific skills...`}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-4 pt-4">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-gray-800 text-white border-2 border-gray-600 py-3 px-4 rounded-none hover:bg-gray-700 hover:border-white transition-colors font-mono uppercase tracking-wider"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleCreateJob}
                  className="flex-1 bg-green-900 text-white border-2 border-green-700 py-3 px-4 rounded-none hover:bg-green-800 transition-colors font-mono uppercase tracking-wider"
                  disabled={!newJob.title || !newJob.company || !newJob.location || !newJob.description}
                >
                  POST JOB
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
