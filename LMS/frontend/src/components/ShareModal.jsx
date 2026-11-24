import React, { useState } from 'react';
import { 
  X, Copy, CheckCircle2, QrCode, Link2, Share2, Download,
  Facebook, Twitter, MessageCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const ShareModal = ({
  show,
  onClose,
  shareUrl,
  shareText = '',
  title = 'Share this link',
  subtitle = 'Invite people to join'
}) => {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  if (!show || !shareUrl) return null;

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(shareUrl)}`;
  const socialShareText = [shareText, shareUrl].filter(Boolean).join('\n');

  const fetchQrImage = async () => {
    const response = await fetch(qrCodeUrl);
    if (!response.ok) throw new Error('Could not load the QR image');
    return response.blob();
  };

  const downloadQrImage = (imageBlob) => {
    const objectUrl = URL.createObjectURL(imageBlob);
    const downloadLink = document.createElement('a');
    downloadLink.href = objectUrl;
    downloadLink.download = 'gracified-qr-code.png';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };

  const handleShareQrImage = async () => {
    setSharing(true);
    try {
      const imageBlob = await fetchQrImage();
      const qrFile = new File([imageBlob], 'gracified-qr-code.png', {
        type: imageBlob.type || 'image/png'
      });
      const shareData = {
        files: [qrFile],
        title,
        text: [shareText, shareUrl].filter(Boolean).join('\n'),
        url: shareUrl
      };

      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [qrFile] }))) {
        await navigator.share(shareData);
        return;
      }

      downloadQrImage(imageBlob);
      toast('QR image downloaded. Attach it in your sharing app and include the link.');
    } catch (error) {
      if (error.name !== 'AbortError') {
        toast.error(error.message || 'Could not share the QR image');
      }
    } finally {
      setSharing(false);
    }
  };

  const handleDownloadQrImage = async () => {
    setSharing(true);
    try {
      downloadQrImage(await fetchQrImage());
      toast.success('QR image downloaded');
    } catch (error) {
      toast.error(error.message || 'Could not download the QR image');
    } finally {
      setSharing(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy the link');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4">
      <div className="relative w-full max-w-md bg-card text-foreground rounded-xl shadow-none border border-border p-8 animate-fade-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-muted text-muted-foreground rounded-xl hover:bg-muted/80 hover:text-foreground transition-all border border-border"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 bg-primary/10 text-primary rounded-xl flex items-center justify-center border border-primary/20">
            <QrCode className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-wide italic">{title}</h3>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground opacity-70">{subtitle}</p>
          </div>
        </div>

        <div className="flex flex-col items-center mb-6">
          <img
            src={qrCodeUrl}
            alt="QR code for this link"
            className="w-44 h-44 rounded-xl border border-border bg-white p-2"
          />
          <p className="mt-3 text-xs font-semibold tracking-wide text-muted-foreground/60 text-center">Scan to open</p>
        </div>

        <div className="flex items-center gap-2 p-3 bg-muted/40 rounded-xl border border-border mb-5">
          <Link2 className="w-4 h-4 text-primary shrink-0" />
          <span className="flex-1 text-xs font-semibold text-muted-foreground truncate">{shareUrl}</span>
          <button
            onClick={handleCopyLink}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-xl text-xs font-semibold tracking-wide hover:bg-primary/90 transition-all"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleShareQrImage}
            disabled={sharing}
            className="flex flex-1 items-center justify-center gap-2 p-3 bg-primary text-white rounded-xl border border-primary hover:bg-primary/90 transition-all disabled:opacity-60"
          >
            <Share2 className="w-4 h-4" />
            <span className="text-xs font-semibold tracking-wide">{sharing ? 'Preparing image...' : 'Share QR image'}</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadQrImage}
            disabled={sharing}
            aria-label="Download QR image"
            title="Download the QR image"
            className="flex items-center justify-center gap-2 px-4 py-3 bg-muted/40 text-muted-foreground rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all disabled:opacity-60"
          >
            <Download className="w-4 h-4" />
            <span className="text-xs font-semibold tracking-wide">Download</span>
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(socialShareText)}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Share link on WhatsApp"
            className="flex flex-col items-center gap-2 p-3 bg-muted/40 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all"
          >
            <MessageCircle className="w-5 h-5 text-emerald-500" />
            <span className="text-xs font-semibold tracking-wide text-muted-foreground">WhatsApp</span>
          </a>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Share link on Facebook"
            className="flex flex-col items-center gap-2 p-3 bg-muted/40 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all"
          >
            <Facebook className="w-5 h-5 text-blue-500" />
            <span className="text-xs font-semibold tracking-wide text-muted-foreground">Facebook</span>
          </a>
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Share link on X"
            className="flex flex-col items-center gap-2 p-3 bg-muted/40 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all"
          >
            <Twitter className="w-5 h-5 text-sky-500" />
            <span className="text-xs font-semibold tracking-wide text-muted-foreground">X</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
