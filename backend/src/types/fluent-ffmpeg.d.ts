declare module 'fluent-ffmpeg' {
  interface FfmpegCommand {
    input(path: string): FfmpegCommand
    output(path: string): FfmpegCommand
    outputOptions(options: string | string[]): FfmpegCommand
    audioCodec(codec: string): FfmpegCommand
    videoCodec(codec: string): FfmpegCommand
    size(size: string): FfmpegCommand
    duration(duration: string | number): FfmpegCommand
    seek(time: string | number): FfmpegCommand
    on(event: string, callback: (data: any) => void): FfmpegCommand
    run(): FfmpegCommand
    save(path: string): FfmpegCommand
    pipe(stream: any): FfmpegCommand
    toFormat(format: string): FfmpegCommand
    audioChannels(channels: number): FfmpegCommand
    audioFrequency(freq: number): FfmpegCommand
    audioBitrate(bitrate: string | number): FfmpegCommand
    videoBitrate(bitrate: string | number): FfmpegCommand
    fps(fps: number): FfmpegCommand
    aspect(aspect: string): FfmpegCommand
    autopad(color?: string): FfmpegCommand
    scale(width: number, height: number): FfmpegCommand
    crop(width: number, height: number, x?: number, y?: number): FfmpegCommand
    trim(start: number, duration: number): FfmpegCommand
    complexFilter(filter: string): FfmpegCommand
    map(stream: string): FfmpegCommand
    preset(preset: string): FfmpegCommand
    crf(value: number): FfmpegCommand
    threads(threads: number): FfmpegCommand
    overwrite(): FfmpegCommand
    noAudio(): FfmpegCommand
    noVideo(): FfmpegCommand
    audioFilters(filters: string | string[]): FfmpegCommand
    videoFilters(filters: string | string[]): FfmpegCommand
    format(format: string): FfmpegCommand
    screenshots(options: any): FfmpegCommand
    thumbnail(time: string | number): FfmpegCommand
    addInput(path: string): FfmpegCommand
    mergeToFile(path: string): FfmpegCommand
    kill(signal?: string): void
    audioQuality(quality: number): FfmpegCommand
  }

  interface FfmpegStatic {
    (input?: string): FfmpegCommand
    setFfmpegPath(path: string): void
    setFfprobePath(path: string): void
    setFlvtoolPath(path: string): void
    getAvailableCodecs(callback: (err: any, codecs: any) => void): void
    getAvailableFormats(callback: (err: any, formats: any) => void): void
    getAvailableEncoders(callback: (err: any, encoders: any) => void): void
    getAvailableFilters(callback: (err: any, filters: any) => void): void
    ffprobe(path: string, callback: (err: any, data: any) => void): void
  }

  const ffmpeg: FfmpegStatic
  export = ffmpeg
  export { FfmpegCommand, FfmpegStatic }
} 