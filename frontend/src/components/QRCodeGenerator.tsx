import React, { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'

interface QRCodeGeneratorProps {
  moduleId: string
  moduleTitle: string
  onClose?: () => void
}

export default function QRCodeGenerator({ moduleId, moduleTitle, onClose }: QRCodeGeneratorProps) {
  const [copied, setCopied] = useState(false)
  
  // Get the current domain for the share URL
  const baseUrl = window.location.origin
  const shareUrl = `${baseUrl}/share/${moduleId}`
  
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy URL:', err)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Share Training Module</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          )}
        </div>
        
        <div className="text-center mb-4">
          <h3 className="font-medium text-gray-900 mb-2">{moduleTitle}</h3>
          <p className="text-sm text-gray-600 mb-4">
            Scan this QR code to access the training module
          </p>
        </div>
        
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-white border rounded-lg">
            <QRCodeSVG
              value={shareUrl}
              size={200}
              level="M"
              includeMargin={true}
            />
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded border">
            <input
              type="text"
              value={shareUrl}
              readOnly
              className="flex-1 text-sm bg-transparent outline-none"
            />
            <button
              onClick={copyToClipboard}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          
          <div className="text-center">
            <p className="text-xs text-gray-500">
              Share this link or QR code with anyone who needs access to this training module.
              <br />
              <strong>No login required</strong> - they can start learning immediately!
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 
