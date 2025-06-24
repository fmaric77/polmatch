import React, { useState } from 'react';
import ImageUrlInput from './ImageUrlInput';

const ImageValidationDemo: React.FC = () => {
  const [basicUrl, setBasicUrl] = useState('');
  const [loveUrl, setLoveUrl] = useState('');
  const [businessUrl, setBusinessUrl] = useState('');

  const testUrls = {
    valid: [
      'https://picsum.photos/200/300.jpg',
      'https://via.placeholder.com/150.png',
      'https://example.com/image.webp'
    ],
    invalid: [
      'not-a-url',
      'http://localhost/image.jpg',
      'https://example.com/file.txt',
      'javascript:alert("xss")',
      'data:image/png;base64,invalid'
    ]
  };

  const loadTestUrl = (url: string, type: 'basic' | 'love' | 'business') => {
    switch (type) {
      case 'basic':
        setBasicUrl(url);
        break;
      case 'love':
        setLoveUrl(url);
        break;
      case 'business':
        setBusinessUrl(url);
        break;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-black text-white">
      <h1 className="text-2xl font-bold font-mono mb-6 uppercase tracking-wider">
        Image URL Validation Demo
      </h1>

      {/* Test URLs */}
      <div className="mb-8 p-4 border border-white/30 rounded-lg bg-black/40">
        <h2 className="text-lg font-mono mb-4 uppercase tracking-wider">Test URLs</h2>
        
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-green-400 font-mono mb-2 uppercase">Valid URLs:</h3>
            <div className="space-y-2">
              {testUrls.valid.map((url, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <code className="text-xs bg-gray-800 p-1 rounded flex-1">{url}</code>
                  <button
                    onClick={() => loadTestUrl(url, 'basic')}
                    className="text-xs bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded"
                  >
                    Test
                  </button>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <h3 className="text-red-400 font-mono mb-2 uppercase">Invalid URLs:</h3>
            <div className="space-y-2">
              {testUrls.invalid.map((url, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <code className="text-xs bg-gray-800 p-1 rounded flex-1">{url}</code>
                  <button
                    onClick={() => loadTestUrl(url, 'basic')}
                    className="text-xs bg-red-600 hover:bg-red-700 px-2 py-1 rounded"
                  >
                    Test
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Demo Forms */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="bg-black/40 border border-white/30 rounded-lg p-4">
          <h3 className="text-lg font-mono mb-4 uppercase tracking-wider">Basic Profile</h3>
          <ImageUrlInput
            label="Profile Picture URL"
            value={basicUrl}
            onChange={setBasicUrl}
            placeholder="Enter basic profile image URL"
            showPreview={true}
            validateOnLoad={true}
          />
        </div>

        <div className="bg-black/40 border border-white/30 rounded-lg p-4">
          <h3 className="text-lg font-mono mb-4 uppercase tracking-wider">Love Profile</h3>
          <ImageUrlInput
            label="Profile Picture URL"
            value={loveUrl}
            onChange={setLoveUrl}
            placeholder="Enter love profile image URL"
            showPreview={true}
            validateOnLoad={true}
          />
        </div>

        <div className="bg-black/40 border border-white/30 rounded-lg p-4">
          <h3 className="text-lg font-mono mb-4 uppercase tracking-wider">Business Profile</h3>
          <ImageUrlInput
            label="Profile Picture URL"
            value={businessUrl}
            onChange={setBusinessUrl}
            placeholder="Enter business profile image URL"
            showPreview={true}
            validateOnLoad={true}
          />
        </div>
      </div>

      {/* Validation Features */}
      <div className="mt-8 p-4 border border-white/30 rounded-lg bg-black/40">
        <h2 className="text-lg font-mono mb-4 uppercase tracking-wider">Validation Features</h2>
        
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="text-green-400 font-mono mb-2">✅ Security Checks:</h4>
            <ul className="space-y-1 text-gray-300 font-mono">
              <li>• Blocks local/private IP addresses</li>
              <li>• Prevents JavaScript/XSS injection</li>
              <li>• Requires HTTPS for security warnings</li>
              <li>• Validates URL format and structure</li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-blue-400 font-mono mb-2">🔍 Format Validation:</h4>
            <ul className="space-y-1 text-gray-300 font-mono">
              <li>• Supports: JPG, PNG, GIF, WebP, SVG</li>
              <li>• Real-time URL validation</li>
              <li>• Image loading verification</li>
              <li>• Size and dimension checks</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageValidationDemo; 