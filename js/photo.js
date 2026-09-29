/* 인증·분실물 사진을 Firestore 문서 한도 안의 JPEG로 줄인다.
   캔버스로 다시 그리므로 원본의 EXIF 위치 정보도 전송하지 않는다. */
(function () {
  'use strict';

  const MAX_INPUT = 12 * 1024 * 1024;
  const MAX_DATA_URL = 350000;

  async function prepare(file) {
    if (!file || !file.type.startsWith('image/')) throw new Error('이미지 파일을 선택해 주세요.');
    if (file.size > MAX_INPUT) throw new Error('원본 사진은 12MB 이하로 올려주세요.');

    let bitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (err) {
      bitmap = await new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('사진을 읽을 수 없습니다. 다른 파일을 선택해 주세요.')); };
        img.src = url;
      });
    }

    try {
      const canvas = document.createElement('canvas');
      let scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('이 브라우저에서 사진을 처리할 수 없습니다.');
      for (let attempt = 0; attempt < 8; attempt++) {
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const data = canvas.toDataURL('image/jpeg', Math.max(.57, .82 - attempt * .035));
        if (data.startsWith('data:image/jpeg;base64,') && data.length <= MAX_DATA_URL) return data;
        if (Math.max(canvas.width, canvas.height) < 1000)
          throw new Error('글자를 읽을 수 있도록 인증 부분만 잘라 다시 올려주세요.');
        scale *= .82;
      }
      throw new Error('사진을 충분히 줄일 수 없습니다. 더 작은 사진을 선택해 주세요.');
    } finally {
      if (bitmap.close) bitmap.close();
    }
  }

  window.PHOTO = { prepare, MAX_DATA_URL };
})();
