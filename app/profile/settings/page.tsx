"use client";
import { useState, useEffect } from "react";
import { v4 as uuidv4 } from 'uuid';
import Header from '../../../components/Header';

interface Profile {
  profile_id: string;
  user_id: string;
  display_name: string;
  bio: string;
  profile_picture_url: string;
  visibility: string;
  last_updated: string;
  assigned_questionnaires: Record<string, unknown>;
  completed_questionnaires: Record<string, unknown>;
}

export default function ProfileSettings() {
  const [activeTab, setActiveTab] = useState<'basic' | 'love' | 'business'>('basic');
  // Profile state for all types
  const [basicProfile, setBasicProfile] = useState<Profile | null>(null);
  const [loveProfile, setLoveProfile] = useState<Profile | null>(null);
  const [businessProfile, setBusinessProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // Helper to ensure profile has all required fields
  function getDefaultProfile(type: 'basic' | 'love' | 'business', user_id: string): Profile {
    return {
      profile_id: uuidv4(),
      user_id,
      display_name: '',
      bio: '',
      profile_picture_url: '',
      visibility: 'public',
      last_updated: new Date().toISOString(),
      assigned_questionnaires: {},
      completed_questionnaires: {},
    };
  }

  // Fetch user_id from session
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/session').then(r => r.json()).then(data => {
      if (data.user?.user_id) setUserId(data.user.user_id);
    });
  }, []);

  useEffect(() => {
    async function fetchProfiles() {
      setLoading(true);
      const [basic, love, business] = await Promise.all([
        fetch("/api/profile/basic").then(r => r.json()),
        fetch("/api/profile/love").then(r => r.json()),
        fetch("/api/profile/business").then(r => r.json()),
      ]);
      setBasicProfile(basic.profile || null);
      setLoveProfile(love.profile || null);
      setBusinessProfile(business.profile || null);
      setLoading(false);
    }
    fetchProfiles();
  }, [userId]);

  const handleProfileChange = (type: 'basic' | 'love' | 'business', field: string, value: string) => {
    if (type === 'basic') setBasicProfile((prev) => prev ? { ...prev, [field]: value } : prev);
    if (type === 'love') setLoveProfile((prev) => prev ? { ...prev, [field]: value } : prev);
    if (type === 'business') setBusinessProfile((prev) => prev ? { ...prev, [field]: value } : prev);
  };

  const handleProfileSave = async (type: 'basic' | 'love' | 'business') => {
    setMessage("");
    let profile: Profile | null = null;
    if (type === 'basic') profile = basicProfile;
    if (type === 'love') profile = loveProfile;
    if (type === 'business') profile = businessProfile;
    if (!profile) return;
    let url;
    if (type === 'basic') url = '/api/profile/basic';
    if (type === 'love') url = '/api/profile/love';
    if (type === 'business') url = '/api/profile/business';
    const res = await fetch(url!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    const data = await res.json();
    if (data.success) setMessage("Profile saved!");
    else setMessage(data.message || "Failed to save profile");
  };

  // Render
  if (loading) return <div className="text-white p-8">Loading...</div>;

  return (
    <div className="flex min-h-screen bg-black text-white">
      <Header />
      <div className="flex-1 max-w-xl mx-auto p-8 bg-black text-white rounded-lg shadow-lg mt-8">
        <h1 className="text-2xl font-bold mb-6">Profile Settings</h1>
        <div className="flex gap-4 mb-6">
          <button className={`px-4 py-2 rounded ${activeTab === 'basic' ? 'bg-white text-black' : 'bg-gray-800 text-white'}`} onClick={() => setActiveTab('basic')}>Basic</button>
          <button className={`px-4 py-2 rounded ${activeTab === 'love' ? 'bg-white text-black' : 'bg-gray-800 text-white'}`} onClick={() => setActiveTab('love')}>Love</button>
          <button className={`px-4 py-2 rounded ${activeTab === 'business' ? 'bg-white text-black' : 'bg-gray-800 text-white'}`} onClick={() => setActiveTab('business')}>Business</button>
        </div>
        {activeTab === 'basic' && (basicProfile || userId) && (
          <form onSubmit={e => { e.preventDefault(); if (!basicProfile && userId) setBasicProfile(getDefaultProfile('basic', userId)); handleProfileSave('basic'); }} className="flex flex-col gap-4">
            <input type="text" name="display_name" placeholder="Display Name" value={basicProfile?.display_name || ''} onChange={e => handleProfileChange('basic', 'display_name', e.target.value)} className="p-2 bg-black text-white border border-white rounded focus:outline-none" />
            <textarea name="bio" placeholder="Bio" value={basicProfile?.bio || ''} onChange={e => handleProfileChange('basic', 'bio', e.target.value)} className="p-2 bg-black text-white border border-white rounded focus:outline-none" />
            <input type="text" name="profile_picture_url" placeholder="Profile Picture URL" value={basicProfile?.profile_picture_url || ''} onChange={e => handleProfileChange('basic', 'profile_picture_url', e.target.value)} className="p-2 bg-black text-white border border-white rounded focus:outline-none" />
            <select name="visibility" value={basicProfile?.visibility || 'public'} onChange={e => handleProfileChange('basic', 'visibility', e.target.value)} className="p-2 bg-black text-white border border-white rounded focus:outline-none">
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
            {/* Assigned/Completed questionnaires as JSON for now */}
            <textarea name="assigned_questionnaires" placeholder="Assigned Questionnaires (JSON)" value={JSON.stringify(basicProfile?.assigned_questionnaires || {})} onChange={e => handleProfileChange('basic', 'assigned_questionnaires', JSON.parse(e.target.value || '{}'))} className="p-2 bg-black text-white border border-white rounded focus:outline-none" />
            <textarea name="completed_questionnaires" placeholder="Completed Questionnaires (JSON)" value={JSON.stringify(basicProfile?.completed_questionnaires || {})} onChange={e => handleProfileChange('basic', 'completed_questionnaires', JSON.parse(e.target.value || '{}'))} className="p-2 bg-black text-white border border-white rounded focus:outline-none" />
            <button type="submit" className="p-2 bg-white text-black rounded hover:bg-gray-200 transition-colors">{basicProfile ? 'Save' : 'Create'}</button>
          </form>
        )}
        {activeTab === 'love' && (loveProfile || userId) && (
          <form onSubmit={e => { e.preventDefault(); if (!loveProfile && userId) setLoveProfile(getDefaultProfile('love', userId)); handleProfileSave('love'); }} className="flex flex-col gap-4">
            <input type="text" name="display_name" placeholder="Display Name" value={loveProfile?.display_name || ''} onChange={e => handleProfileChange('love', 'display_name', e.target.value)} className="p-2 bg-black text-white border border-white rounded focus:outline-none" />
            <textarea name="bio" placeholder="Bio" value={loveProfile?.bio || ''} onChange={e => handleProfileChange('love', 'bio', e.target.value)} className="p-2 bg-black text-white border border-white rounded focus:outline-none" />
            <input type="text" name="profile_picture_url" placeholder="Profile Picture URL" value={loveProfile?.profile_picture_url || ''} onChange={e => handleProfileChange('love', 'profile_picture_url', e.target.value)} className="p-2 bg-black text-white border border-white rounded focus:outline-none" />
            <select name="visibility" value={loveProfile?.visibility || 'public'} onChange={e => handleProfileChange('love', 'visibility', e.target.value)} className="p-2 bg-black text-white border border-white rounded focus:outline-none">
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
            <textarea name="assigned_questionnaires" placeholder="Assigned Questionnaires (JSON)" value={JSON.stringify(loveProfile?.assigned_questionnaires || {})} onChange={e => handleProfileChange('love', 'assigned_questionnaires', JSON.parse(e.target.value || '{}'))} className="p-2 bg-black text-white border border-white rounded focus:outline-none" />
            <textarea name="completed_questionnaires" placeholder="Completed Questionnaires (JSON)" value={JSON.stringify(loveProfile?.completed_questionnaires || {})} onChange={e => handleProfileChange('love', 'completed_questionnaires', JSON.parse(e.target.value || '{}'))} className="p-2 bg-black text-white border border-white rounded focus:outline-none" />
            <button type="submit" className="p-2 bg-white text-black rounded hover:bg-gray-200 transition-colors">{loveProfile ? 'Save' : 'Create'}</button>
          </form>
        )}
        {activeTab === 'business' && (businessProfile || userId) && (
          <form onSubmit={e => { e.preventDefault(); if (!businessProfile && userId) setBusinessProfile(getDefaultProfile('business', userId)); handleProfileSave('business'); }} className="flex flex-col gap-4">
            <input type="text" name="display_name" placeholder="Display Name" value={businessProfile?.display_name || ''} onChange={e => handleProfileChange('business', 'display_name', e.target.value)} className="p-2 bg-black text-white border border-white rounded focus:outline-none" />
            <textarea name="bio" placeholder="Bio" value={businessProfile?.bio || ''} onChange={e => handleProfileChange('business', 'bio', e.target.value)} className="p-2 bg-black text-white border border-white rounded focus:outline-none" />
            <input type="text" name="profile_picture_url" placeholder="Profile Picture URL" value={businessProfile?.profile_picture_url || ''} onChange={e => handleProfileChange('business', 'profile_picture_url', e.target.value)} className="p-2 bg-black text-white border border-white rounded focus:outline-none" />
            <select name="visibility" value={businessProfile?.visibility || 'public'} onChange={e => handleProfileChange('business', 'visibility', e.target.value)} className="p-2 bg-black text-white border border-white rounded focus:outline-none">
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
            <textarea name="assigned_questionnaires" placeholder="Assigned Questionnaires (JSON)" value={JSON.stringify(businessProfile?.assigned_questionnaires || {})} onChange={e => handleProfileChange('business', 'assigned_questionnaires', JSON.parse(e.target.value || '{}'))} className="p-2 bg-black text-white border border-white rounded focus:outline-none" />
            <textarea name="completed_questionnaires" placeholder="Completed Questionnaires (JSON)" value={JSON.stringify(businessProfile?.completed_questionnaires || {})} onChange={e => handleProfileChange('business', 'completed_questionnaires', JSON.parse(e.target.value || '{}'))} className="p-2 bg-black text-white border border-white rounded focus:outline-none" />
            <button type="submit" className="p-2 bg-white text-black rounded hover:bg-gray-200 transition-colors">{businessProfile ? 'Save' : 'Create'}</button>
          </form>
        )}
        {message && <div className="text-green-400 text-center mt-2">{message}</div>}
      </div>
    </div>
  );
}
