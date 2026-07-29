export const getVideoEmbedInfo = (url) => {
  if (!url) return null;
  const trimmedUrl = String(url).trim();

  const getYouTubeId = (value) => {
    try {
      const parsed = new URL(value);
      const host = parsed.hostname.replace(/^www\./, '').replace(/^m\./, '');
      if (host === 'youtu.be') return parsed.pathname.split('/').filter(Boolean)[0];
      if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
        if (parsed.searchParams.get('v')) return parsed.searchParams.get('v');
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (['embed', 'shorts', 'live', 'v'].includes(parts[0])) return parts[1];
      }
    } catch (e) {
      // Fall through to regex parsing for pasted or partial URLs.
    }
    const match = value.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?.*v=|embed\/|shorts\/|live\/|v\/))([^#&?/]+)/i);
    return match?.[1];
  };

  // 1. Direct Video Files (Native Player)
  const isDirectFile = /\.(mp4|webm|ogg|m4v|ogv)$/i.test(trimmedUrl.split('?')[0]);
  const isMonosnapDirect = trimmedUrl.includes('monosnap.ai/direct/');
  if (isDirectFile || isMonosnapDirect) {
    return { type: 'direct', embedUrl: trimmedUrl, isDirect: true };
  }

  // 2. YouTube
  const ytId = getYouTubeId(trimmedUrl);
  if (ytId && ytId.length === 11) {
    const ytParams = [
      'playsinline=1',
      'enablejsapi=1',
      'rel=0',
      'modestbranding=1',
      'origin=https://www.youtube.com',
    ].join('&');
    return { type: 'youtube', id: ytId, embedUrl: `https://www.youtube.com/embed/${ytId}?${ytParams}`, baseUrl: 'https://www.youtube.com' };
  }

  // 3. Vimeo
  const vimeoRegExp = /(?:vimeo\.com\/|player\.vimeo\.com\/video\/)([0-9]+)/;
  const vimeoMatch = trimmedUrl.match(vimeoRegExp);
  if (vimeoMatch) {
    return { type: 'vimeo', id: vimeoMatch[1], embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}` };
  }

  // 4. Google Drive
  const driveRegExp = /drive\.google\.com\/file\/d\/([^\/\?]+)/;
  const driveMatch = trimmedUrl.match(driveRegExp);
  if (driveMatch) {
    return { type: 'drive', id: driveMatch[1], embedUrl: `https://drive.google.com/file/d/${driveMatch[1]}/preview` };
  }

  // 5. Dailymotion
  const dailyRegExp = /(?:dailymotion\.com\/video\/|dai\.ly\/)([a-zA-Z0-9]+)/;
  const dailyMatch = trimmedUrl.match(dailyRegExp);
  if (dailyMatch) {
    return { type: 'dailymotion', id: dailyMatch[1], embedUrl: `https://www.dailymotion.com/embed/video/${dailyMatch[1]}` };
  }

  // 6. Loom
  const loomRegExp = /loom\.com\/(?:share|embed)\/([a-f0-9]+)/;
  const loomMatch = trimmedUrl.match(loomRegExp);
  if (loomMatch) {
    return { type: 'loom', id: loomMatch[1], embedUrl: `https://www.loom.com/embed/${loomMatch[1]}` };
  }

  // 7. Wistia
  const wistiaRegExp = /(?:wistia\.com\/medias\/|fast\.wistia\.net\/embed\/iframe\/)([a-zA-Z0-9]+)/;
  const wistiaMatch = trimmedUrl.match(wistiaRegExp);
  if (wistiaMatch) {
    return { type: 'wistia', id: wistiaMatch[1], embedUrl: `https://fast.wistia.net/embed/iframe/${wistiaMatch[1]}` };
  }

  // 8. Twitch
  const twitchRegExp = /twitch\.tv\/videos\/([0-9]+)/;
  const twitchMatch = trimmedUrl.match(twitchRegExp);
  if (twitchMatch) {
    return { type: 'twitch', id: twitchMatch[1], embedUrl: `https://player.twitch.tv/?video=${twitchMatch[1]}&parent=localhost&autoplay=false` };
  }

  // 9. Dropbox (Transform to direct streamable link)
  const dropboxRegExp = /dropbox\.com\/s\/([a-zA-Z0-9]+)\/([^\?]+)/;
  const dropboxMatch = trimmedUrl.match(dropboxRegExp);
  if (dropboxMatch) {
    const directUrl = trimmedUrl.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace(/\?dl=[01]/, '') + (trimmedUrl.includes('?') ? '&raw=1' : '?raw=1');
    return { type: 'dropbox', embedUrl: directUrl, isDirect: true };
  }

  return null;
};
