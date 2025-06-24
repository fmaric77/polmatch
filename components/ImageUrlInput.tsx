import React, { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faImage, faCheck, faTimes, faExclamationTriangle, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import { useImageValidation, ImageValidationResult } from '../lib/image-validation';

interface ImageUrlInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  showPreview?: boolean;
  validateOnLoad?: boolean;
}

const ImageUrlInput: React.FC<ImageUrlInputProps> = ({
  value,
  onChange,
  placeholder = "Enter image URL",
  className = "",
  disabled = false,
  required = false,
  label = "Image URL",
  showPreview = true,
  validateOnLoad = true
}) => {
  const [validation, setValidation] = useState<ImageValidationResult>({ isValid: true });
  const [isValidating, setIsValidating] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  
  const { validateUrl, validateUrlWithLoading, supportedFormats } = useImageValidation();

  // Debounced validation
  const validateUrlDebounced = useCallback(
    async (url: string) => {
      if (!url.trim()) {
        setValidation({ isValid: true });
        setIsValidating(false);
        return;
      }

      setIsValidating(true);
      
      try {
        let result: ImageValidationResult;
        
        if (validateOnLoad) {
          result = await validateUrlWithLoading(url);
        } else {
          result = validateUrl(url);
        }
        
        setValidation(result);
      } catch {
        setValidation({ isValid: false, error: 'Validation failed' });
      } finally {
        setIsValidating(false);
      }
    },
    [validateUrl, validateUrlWithLoading, validateOnLoad]
  );

  // Debounce validation calls
  useEffect(() => {
    const timer = setTimeout(() => {
      validateUrlDebounced(value);
    }, 500);

    return () => clearTimeout(timer);
  }, [value, validateUrlDebounced]);

  // Reset image load error when URL changes
  useEffect(() => {
    setImageLoadError(false);
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const togglePreview = () => {
    setShowImagePreview(!showImagePreview);
  };

  const getValidationIcon = () => {
    if (isValidating) {
      return <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full" />;
    }
    
    if (!value.trim()) {
      return null;
    }
    
    if (validation.isValid) {
      return <FontAwesomeIcon icon={faCheck} className="text-green-400" />;
    } else {
      return <FontAwesomeIcon icon={faTimes} className="text-red-400" />;
    }
  };

  const getValidationMessage = () => {
    if (!value.trim() || isValidating) {
      return null;
    }

    if (validation.error) {
      return (
        <div className="text-red-400 text-xs mt-1 font-mono flex items-center">
          <FontAwesomeIcon icon={faTimes} className="mr-1" />
          {validation.error}
        </div>
      );
    }

    if (validation.warnings && validation.warnings.length > 0) {
      return (
        <div className="text-yellow-400 text-xs mt-1 font-mono">
          {validation.warnings.map((warning, index) => (
            <div key={index} className="flex items-center">
              <FontAwesomeIcon icon={faExclamationTriangle} className="mr-1" />
              {warning}
            </div>
          ))}
        </div>
      );
    }

    if (validation.isValid) {
      return (
        <div className="text-green-400 text-xs mt-1 font-mono flex items-center">
          <FontAwesomeIcon icon={faCheck} className="mr-1" />
          Valid image URL
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-2">
      {/* Label */}
      <label className="block text-sm font-mono font-medium uppercase tracking-wider text-gray-300">
        <FontAwesomeIcon icon={faImage} className="mr-2" />
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>

      {/* Input with validation icon */}
      <div className="relative">
        <input
          type="url"
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`w-full p-3 pr-12 bg-black text-white border border-white rounded focus:outline-none focus:border-white/60 font-mono ${className} ${
            validation.isValid ? 'border-white' : 'border-red-400'
          }`}
        />
        
        {/* Validation icon */}
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          {getValidationIcon()}
        </div>
      </div>

      {/* Validation message */}
      {getValidationMessage()}

      {/* Supported formats info */}
      <div className="text-xs text-gray-500 font-mono">
        Supported formats: {supportedFormats.join(', ')}
      </div>

      {/* Preview controls */}
      {showPreview && value.trim() && validation.isValid && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={togglePreview}
            className="text-blue-400 hover:text-blue-300 text-xs font-mono flex items-center transition-colors"
          >
            <FontAwesomeIcon icon={showImagePreview ? faEyeSlash : faEye} className="mr-1" />
            {showImagePreview ? 'Hide Preview' : 'Show Preview'}
          </button>

          {/* Image preview */}
          {showImagePreview && (
            <div className="border border-white/30 rounded-lg p-4 bg-black/40">
              <div className="text-xs text-gray-400 font-mono mb-2 uppercase tracking-wider">
                Preview:
              </div>
              {!imageLoadError ? (
                <img
                  src={value}
                  alt="Profile preview"
                  className="max-w-full max-h-48 object-contain rounded border border-white/20"
                  onError={() => setImageLoadError(true)}
                  onLoad={() => setImageLoadError(false)}
                />
              ) : (
                <div className="flex items-center justify-center h-24 bg-gray-800 rounded border border-white/20">
                  <div className="text-gray-400 text-sm font-mono flex items-center">
                    <FontAwesomeIcon icon={faTimes} className="mr-2" />
                    Failed to load image
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ImageUrlInput; 