/* RTC Bricks, Copyright (c) 2026 Kundan Singh <theintencity@gmail.com>, See LICENSE. */
navigator.mediaDevices.getDisplayMedia=async()=>{var e=await globalThis.electron.getDisplayMedia();return await navigator.mediaDevices.getUserMedia({audio:!1,video:{mandatory:{chromeMediaSource:"desktop",chromeMediaSourceId:e.id}}})};
