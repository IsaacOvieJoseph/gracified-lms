export const getVideoEmbedInfo = (url) => {
  if (!url) return null;

  // 1. Direct Video Files (Native Player)
  const isDirectFile = /\.(mp4|webm|ogg|m4v|ogv)$/i.test(url.split('?')[0]);
  const isMonosnapDirect = url.includes('monosnap.ai/direct/');
  if (isDirectFile || isMonosnapDirect) {
    return { type: 'direct', embedUrl: url, isDirect: true };
  }

  // 2. YouTube
  const ytRegExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const ytMatch = url.match(ytRegExp);
  if (ytMatch && ytMatch[2].length === 11) {
    return { type: 'youtube', id: ytMatch[2], embedUrl: `https://www.youtube.com/embed/${ytMatch[2]}` };
  }

  // 3. Vimeo
  const vimeoRegExp = /(?:vimeo\.com\/|player\.vimeo\.com\/video\/)([0-9]+)/;
  const vimeoMatch = url.match(vimeoRegExp);
  if (vimeoMatch) {
    return { type: 'vimeo', id: vimeoMatch[1], embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}` };
  }

  // 4. Google Drive
  const driveRegExp = /drive\.google\.com\/file\/d\/([^\/\?]+)/;
  const driveMatch = url.match(driveRegExp);
  if (driveMatch) {
    return { type: 'drive', id: driveMatch[1], embedUrl: `https://drive.google.com/file/d/${driveMatch[1]}/preview` };
  }

  // 5. Dailymotion
  const dailyRegExp = /(?:dailymotion\.com\/video\/|dai\.ly\/)([a-zA-Z0-9]+)/;
  const dailyMatch = url.match(dailyRegExp);
  if (dailyMatch) {
    return { type: 'dailymotion', id: dailyMatch[1], embedUrl: `https://www.dailymotion.com/embed/video/${dailyMatch[1]}` };
  }

  // 6. Loom
  const loomRegExp = /loom\.com\/(?:share|embed)\/([a-f0-9]+)/;
  const loomMatch = url.match(loomRegExp);
  if (loomMatch) {
    return { type: 'loom', id: loomMatch[1], embedUrl: `https://www.loom.com/embed/${loomMatch[1]}` };
  }

  // 7. Wistia
  const wistiaRegExp = /(?:wistia\.com\/medias\/|fast\.wistia\.net\/embed\/iframe\/)([a-zA-Z0-9]+)/;
  const wistiaMatch = url.match(wistiaRegExp);
  if (wistiaMatch) {
    return { type: 'wistia', id: wistiaMatch[1], embedUrl: `https://fast.wistia.net/embed/iframe/${wistiaMatch[1]}` };
  }

  // 8. Twitch
  const twitchRegExp = /twitch\.tv\/videos\/([0-9]+)/;
  const twitchMatch = url.match(twitchRegExp);
  if (twitchMatch) {
    return { type: 'twitch', id: twitchMatch[1], embedUrl: `https://player.twitch.tv/?video=${twitchMatch[1]}&parent=localhost&autoplay=false` };
  }

  // 9. Dropbox (Transform to direct streamable link)
  const dropboxRegExp = /dropbox\.com\/s\/([a-zA-Z0-9]+)\/([^\?]+)/;
  const dropboxMatch = url.match(dropboxRegExp);
  if (dropboxMatch) {
    const directUrl = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace(/\?dl=[01]/, '') + (url.includes('?') ? '&raw=1' : '?raw=1');
    return { type: 'dropbox', embedUrl: directUrl, isDirect: true };
  }

  return null;
};
