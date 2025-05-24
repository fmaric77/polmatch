"use client";
import Header from '../../../../components/Header';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Question {
  question_id: string;
  question_text: string;
  question_type: string;
  options: string[];
  is_required: boolean;
  display_order: number;
}

interface Questionnaire {
  questionnaire_id: string;
  title: string;
  description: string;
  is_hidden: boolean;
  creation_date: string;
  questions: Question[];
}

interface QuestionnaireGroup {
  group_id: string;
  title: string;
  description: string;
  profile_type: string;
  is_hidden: boolean;
  creation_date: string;
  creator_username: string;
  questionnaires: Questionnaire[];
}

export default function ManageQuestionnaireGroup({ params }: { params: Promise<{ id: string }> }) {
  const [group, setGroup] = useState<QuestionnaireGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateQuestionnaire, setShowCreateQuestionnaire] = useState(false);
  const [questionnaireForm, setQuestionnaireForm] = useState({
    title: '',
    description: '',
    is_hidden: false,
    questions: [{ question_text: '', question_type: 'text', options: [], is_required: false }]
  });
  const [submitMessage, setSubmitMessage] = useState('');
  const [showEditQuestionnaire, setShowEditQuestionnaire] = useState(false);
  const [editQuestionnaireForm, setEditQuestionnaireForm] = useState<any>(null);
  const [editSubmitMessage, setEditSubmitMessage] = useState('');
  const [editingQuestionnaireId, setEditingQuestionnaireId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Check if user is admin
    async function checkAdmin() {
      const res = await fetch('/api/session');
      const data = await res.json();
      if (!data.valid || !data.user?.is_admin) {
        router.replace('/');
        return;
      }
    }
    checkAdmin();
  }, [router]);

  useEffect(() => {
    async function fetchGroup() {
      try {
        const resolvedParams = await params;
        const res = await fetch(`/api/admin/questionnaires/${resolvedParams.id}`);
        const data = await res.json();
        
        if (data.success) {
          setGroup(data.questionnaireGroup);
        } else {
          setError(data.message || 'Failed to fetch questionnaire group');
        }
      } catch (err) {
        setError('Failed to fetch questionnaire group');
      } finally {
        setLoading(false);
      }
    }

    fetchGroup();
  }, [params]);

  const handleCreateQuestionnaire = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitMessage('');

    try {
      const resolvedParams = await params;
      const res = await fetch(`/api/admin/questionnaires/${resolvedParams.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(questionnaireForm),
      });
      
      const data = await res.json();
      if (data.success) {
        setSubmitMessage('Questionnaire created successfully!');
        setShowCreateQuestionnaire(false);
        setQuestionnaireForm({
          title: '',
          description: '',
          is_hidden: false,
          questions: [{ question_text: '', question_type: 'text', options: [], is_required: false }]
        });
        // Refresh the group data
        window.location.reload();
      } else {
        setSubmitMessage(data.message || 'Failed to create questionnaire');
      }
    } catch (err) {
      setSubmitMessage('Failed to create questionnaire');
    }
  };

  const addQuestion = () => {
    setQuestionnaireForm(prev => ({
      ...prev,
      questions: [...prev.questions, { question_text: '', question_type: 'text', options: [], is_required: false }]
    }));
  };

  const removeQuestion = (index: number) => {
    setQuestionnaireForm(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index)
    }));
  };

  const updateQuestion = (index: number, field: string, value: any) => {
    setQuestionnaireForm(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => 
        i === index ? { ...q, [field]: value } : q
      )
    }));
  };

  const deleteQuestionnaire = async (questionnaireId: string) => {
    if (!window.confirm('Are you sure you want to delete this questionnaire? This will delete all associated questions and user answers.')) return;
    
    try {
      const resolvedParams = await params;
      const res = await fetch(`/api/admin/questionnaires/${resolvedParams.id}/questionnaires/${questionnaireId}`, {
        method: 'DELETE',
      });
      
      const data = await res.json();
      if (data.success) {
        alert('Questionnaire deleted successfully');
        window.location.reload();
      } else {
        alert(data.message || 'Failed to delete questionnaire');
      }
    } catch (err) {
      alert('Failed to delete questionnaire');
    }
  };

  const openEditQuestionnaire = (questionnaire: Questionnaire) => {
    setEditingQuestionnaireId(questionnaire.questionnaire_id);
    setEditQuestionnaireForm({
      title: questionnaire.title,
      description: questionnaire.description,
      is_hidden: questionnaire.is_hidden,
      questions: questionnaire.questions.map(q => ({
        ...q,
        options: q.options || [],
      }))
    });
    setShowEditQuestionnaire(true);
    setEditSubmitMessage('');
  };

  const closeEditQuestionnaire = () => {
    setShowEditQuestionnaire(false);
    setEditQuestionnaireForm(null);
    setEditingQuestionnaireId(null);
    setEditSubmitMessage('');
  };

  const addEditQuestion = () => {
    setEditQuestionnaireForm((prev: any) => ({
      ...prev,
      questions: [...prev.questions, { question_text: '', question_type: 'text', options: [], is_required: false }]
    }));
  };

  const removeEditQuestion = (index: number) => {
    setEditQuestionnaireForm((prev: any) => ({
      ...prev,
      questions: prev.questions.filter((_: any, i: number) => i !== index)
    }));
  };

  const updateEditQuestion = (index: number, field: string, value: any) => {
    setEditQuestionnaireForm((prev: any) => ({
      ...prev,
      questions: prev.questions.map((q: any, i: number) => i === index ? { ...q, [field]: value } : q)
    }));
  };

  const handleEditQuestionnaire = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditSubmitMessage('');
    try {
      const resolvedParams = await params;
      const res = await fetch(`/api/admin/questionnaires/${resolvedParams.id}/questionnaires/${editingQuestionnaireId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editQuestionnaireForm),
      });
      const data = await res.json();
      if (data.success) {
        setEditSubmitMessage('Questionnaire updated successfully!');
        setTimeout(() => {
          closeEditQuestionnaire();
          window.location.reload();
        }, 1000);
      } else {
        setEditSubmitMessage(data.message || 'Failed to update questionnaire');
      }
    } catch (err) {
      setEditSubmitMessage('Failed to update questionnaire');
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <main className="flex flex-col min-h-screen bg-black text-white">
          <div className="w-full max-w-6xl mx-auto mt-12 p-6">
            <div className="text-center">Loading...</div>
          </div>
        </main>
      </>
    );
  }

  if (error || !group) {
    return (
      <>
        <Header />
        <main className="flex flex-col min-h-screen bg-black text-white">
          <div className="w-full max-w-6xl mx-auto mt-12 p-6">
            <div className="bg-black/80 border border-white rounded-lg p-8 text-center">
              <h1 className="text-2xl font-bold mb-4">Error</h1>
              <p className="text-red-400">{error || 'Questionnaire group not found'}</p>
              <button
                onClick={() => router.push('/admindashboard')}
                className="mt-4 px-4 py-2 bg-white text-black rounded hover:bg-gray-200 transition-colors"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="flex flex-col min-h-screen bg-black text-white">
        <div className="w-full max-w-6xl mx-auto mt-12 p-6">
          <div className="bg-black/80 border border-white rounded-lg shadow-lg p-8">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center">
                <button
                  onClick={() => router.push('/admindashboard')}
                  className="mr-4 px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                >
                  ← Back
                </button>
                <div>
                  <h1 className="text-3xl font-bold">{group.title}</h1>
                  <p className="text-gray-300">{group.description}</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateQuestionnaire(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Add Questionnaire
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 text-sm">
              <div>
                <span className="text-gray-400">Profile Type:</span>
                <div className="font-medium capitalize">{group.profile_type}</div>
              </div>
              <div>
                <span className="text-gray-400">Status:</span>
                <div className={group.is_hidden ? 'text-red-400' : 'text-green-400'}>
                  {group.is_hidden ? 'Hidden' : 'Active'}
                </div>
              </div>
              <div>
                <span className="text-gray-400">Created by:</span>
                <div className="font-medium">{group.creator_username || 'Unknown'}</div>
              </div>
              <div>
                <span className="text-gray-400">Questionnaires:</span>
                <div className="font-medium">{group.questionnaires.length}</div>
              </div>
            </div>

            {/* Questionnaires List */}
            <div className="mb-8">
              <h2 className="text-xl font-bold mb-4">Questionnaires</h2>
              {group.questionnaires.length === 0 ? (
                <div className="text-center py-8 text-gray-400 border border-white rounded-lg">
                  No questionnaires in this group. Create your first questionnaire to get started.
                </div>
              ) : (
                <div className="space-y-4">
                  {group.questionnaires.map((questionnaire) => (
                    <div key={questionnaire.questionnaire_id} className="border border-white rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="text-lg font-semibold">{questionnaire.title}</h3>
                          <p className="text-gray-300 text-sm">{questionnaire.description}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditQuestionnaire(questionnaire)}
                            className="px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteQuestionnaire(questionnaire.questionnaire_id)}
                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-4 text-sm text-gray-400 mb-3">
                        <span>Questions: <span className="text-white">{questionnaire.questions.length}</span></span>
                        <span>Status: <span className={questionnaire.is_hidden ? 'text-red-400' : 'text-green-400'}>{questionnaire.is_hidden ? 'Hidden' : 'Active'}</span></span>
                        <span>Created: <span className="text-white">{new Date(questionnaire.creation_date).toLocaleDateString()}</span></span>
                      </div>
                      {questionnaire.questions.length > 0 && (
                        <details className="text-sm">
                          <summary className="cursor-pointer text-blue-400 hover:text-blue-300">
                            View Questions ({questionnaire.questions.length})
                          </summary>
                          <div className="mt-2 pl-4 border-l border-gray-600">
                            {questionnaire.questions.map((question, idx) => (
                              <div key={question.question_id} className="mb-2">
                                <div className="font-medium">{idx + 1}. {question.question_text}</div>
                                <div className="text-gray-400">
                                  Type: {question.question_type} | Required: {question.is_required ? 'Yes' : 'No'}
                                  {question.options.length > 0 && (
                                    <span> | Options: {question.options.join(', ')}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Create Questionnaire Modal */}
            {showCreateQuestionnaire && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                <div className="bg-black border border-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                  <h2 className="text-2xl font-bold mb-4">Create New Questionnaire</h2>
                  
                  <form onSubmit={handleCreateQuestionnaire} className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">Title *</label>
                      <input
                        type="text"
                        value={questionnaireForm.title}
                        onChange={(e) => setQuestionnaireForm(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-blue-400"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Description *</label>
                      <textarea
                        value={questionnaireForm.description}
                        onChange={(e) => setQuestionnaireForm(prev => ({ ...prev, description: e.target.value }))}
                        rows={3}
                        className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-blue-400"
                        required
                      />
                    </div>

                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={questionnaireForm.is_hidden}
                          onChange={(e) => setQuestionnaireForm(prev => ({ ...prev, is_hidden: e.target.checked }))}
                          className="mr-2"
                        />
                        Hidden (not visible to users)
                      </label>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Questions</h3>
                        <button
                          type="button"
                          onClick={addQuestion}
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
                        >
                          Add Question
                        </button>
                      </div>

                      {questionnaireForm.questions.map((question, index) => (
                        <div key={index} className="border border-gray-600 rounded-lg p-4 mb-4">
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="font-medium">Question {index + 1}</h4>
                            {questionnaireForm.questions.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeQuestion(index)}
                                className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
                              >
                                Remove
                              </button>
                            )}
                          </div>

                          <div className="space-y-3">
                            <input
                              type="text"
                              placeholder="Question text"
                              value={question.question_text}
                              onChange={(e) => updateQuestion(index, 'question_text', e.target.value)}
                              className="w-full p-2 bg-black text-white border border-gray-600 rounded focus:outline-none focus:border-blue-400"
                              required
                            />

                            <div className="flex gap-4">
                              <select
                                value={question.question_type}
                                onChange={(e) => updateQuestion(index, 'question_type', e.target.value)}
                                className="p-2 bg-black text-white border border-gray-600 rounded focus:outline-none focus:border-blue-400"
                              >
                                <option value="text">Text</option>
                                <option value="textarea">Long Text</option>
                                <option value="select">Multiple Choice</option>
                                <option value="radio">Single Choice</option>
                                <option value="checkbox">Checkboxes</option>
                                <option value="number">Number</option>
                                <option value="email">Email</option>
                                <option value="url">URL</option>
                              </select>

                              <label className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={question.is_required}
                                  onChange={(e) => updateQuestion(index, 'is_required', e.target.checked)}
                                  className="mr-2"
                                />
                                Required
                              </label>
                            </div>

                            {(question.question_type === 'select' || question.question_type === 'radio' || question.question_type === 'checkbox') && (
                              <div>
                                <label className="block text-sm font-medium mb-2">Options (one per line)</label>
                                <textarea
                                  placeholder="Option 1&#10;Option 2&#10;Option 3"
                                  value={question.options.join('\n')}
                                  onChange={(e) => updateQuestion(index, 'options', e.target.value.split('\n').filter(o => o.trim()))}
                                  rows={3}
                                  className="w-full p-2 bg-black text-white border border-gray-600 rounded focus:outline-none focus:border-blue-400"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-4">
                      <button
                        type="button"
                        onClick={() => setShowCreateQuestionnaire(false)}
                        className="px-6 py-3 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        Create Questionnaire
                      </button>
                    </div>

                    {submitMessage && (
                      <div className={`text-center mt-4 ${submitMessage.includes('success') ? 'text-green-400' : 'text-red-400'}`}>
                        {submitMessage}
                      </div>
                    )}
                  </form>
                </div>
              </div>
            )}

            {/* Edit Questionnaire Modal */}
            {showEditQuestionnaire && editQuestionnaireForm && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                <div className="bg-black border border-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                  <h2 className="text-2xl font-bold mb-4">Edit Questionnaire</h2>
                  <form onSubmit={handleEditQuestionnaire} className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">Title *</label>
                      <input
                        type="text"
                        value={editQuestionnaireForm.title}
                        onChange={(e) => setEditQuestionnaireForm((prev: any) => ({ ...prev, title: e.target.value }))}
                        className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-blue-400"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Description *</label>
                      <textarea
                        value={editQuestionnaireForm.description}
                        onChange={(e) => setEditQuestionnaireForm((prev: any) => ({ ...prev, description: e.target.value }))}
                        rows={3}
                        className="w-full p-3 bg-black text-white border border-white rounded focus:outline-none focus:border-blue-400"
                        required
                      />
                    </div>
                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={editQuestionnaireForm.is_hidden}
                          onChange={(e) => setEditQuestionnaireForm((prev: any) => ({ ...prev, is_hidden: e.target.checked }))}
                          className="mr-2"
                        />
                        Hidden (not visible to users)
                      </label>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Questions</h3>
                        <button
                          type="button"
                          onClick={addEditQuestion}
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
                        >
                          Add Question
                        </button>
                      </div>
                      {editQuestionnaireForm.questions.map((question: any, index: number) => (
                        <div key={index} className="border border-gray-600 rounded-lg p-4 mb-4">
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="font-medium">Question {index + 1}</h4>
                            {editQuestionnaireForm.questions.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeEditQuestion(index)}
                                className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <div className="space-y-3">
                            <input
                              type="text"
                              placeholder="Question text"
                              value={question.question_text}
                              onChange={(e) => updateEditQuestion(index, 'question_text', e.target.value)}
                              className="w-full p-2 bg-black text-white border border-gray-600 rounded focus:outline-none focus:border-blue-400"
                              required
                            />
                            <div className="flex gap-4">
                              <select
                                value={question.question_type}
                                onChange={(e) => updateEditQuestion(index, 'question_type', e.target.value)}
                                className="p-2 bg-black text-white border border-gray-600 rounded focus:outline-none focus:border-blue-400"
                              >
                                <option value="text">Text</option>
                                <option value="textarea">Long Text</option>
                                <option value="select">Multiple Choice</option>
                                <option value="radio">Single Choice</option>
                                <option value="checkbox">Checkboxes</option>
                                <option value="number">Number</option>
                                <option value="email">Email</option>
                                <option value="url">URL</option>
                              </select>
                              <label className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={question.is_required}
                                  onChange={(e) => updateEditQuestion(index, 'is_required', e.target.checked)}
                                  className="mr-2"
                                />
                                Required
                              </label>
                            </div>
                            {(question.question_type === 'select' || question.question_type === 'radio' || question.question_type === 'checkbox') && (
                              <div>
                                <label className="block text-sm font-medium mb-2">Options (one per line)</label>
                                <textarea
                                  placeholder="Option 1\nOption 2\nOption 3"
                                  value={question.options.join('\n')}
                                  onChange={(e) => updateEditQuestion(index, 'options', e.target.value.split('\n').filter((o: string) => o.trim()))}
                                  rows={3}
                                  className="w-full p-2 bg-black text-white border border-gray-600 rounded focus:outline-none focus:border-blue-400"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-4">
                      <button
                        type="button"
                        onClick={closeEditQuestionnaire}
                        className="px-6 py-3 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        Save Changes
                      </button>
                    </div>
                    {editSubmitMessage && (
                      <div className={`text-center mt-4 ${editSubmitMessage.includes('success') ? 'text-green-400' : 'text-red-400'}`}>
                        {editSubmitMessage}
                      </div>
                    )}
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
