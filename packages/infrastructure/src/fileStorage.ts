export interface StoredFile {
  path: string;
  url?: string;
}

export interface FileStorage {
  readonly visibility: 'public' | 'private';
  save(data: Buffer, key: string, contentType: string): Promise<StoredFile>;
  read(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}
