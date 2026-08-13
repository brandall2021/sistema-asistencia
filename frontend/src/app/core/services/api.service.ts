import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { lastValueFrom } from 'rxjs';

export interface QueryParams {
  [key: string]: string | number | boolean | undefined | null;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  rawPost(path: string, body: unknown): Promise<unknown> {
    return lastValueFrom(this.http.post(path, body));
  }

  get<T>(path: string, params?: QueryParams): Promise<T> {
    return lastValueFrom(this.http.get<T>(path, { params: this.params(params) }));
  }

  getBlob(path: string): Promise<Blob> {
    return lastValueFrom(this.http.get(path, { responseType: 'blob' }));
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return lastValueFrom(this.http.post<T>(path, body));
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return lastValueFrom(this.http.patch<T>(path, body));
  }

  put<T>(path: string, body: unknown): Promise<T> {
    return lastValueFrom(this.http.put<T>(path, body));
  }

  delete<T>(path: string): Promise<T> {
    return lastValueFrom(this.http.delete<T>(path));
  }

  private params(params?: QueryParams): HttpParams {
    let p = new HttpParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') {
          p = p.set(k, String(v));
        }
      }
    }
    return p;
  }
}
