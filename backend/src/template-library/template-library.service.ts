import { Injectable } from '@nestjs/common';
import {
  INDUSTRIES,
  LibraryTemplate,
  TEMPLATE_LIBRARY,
  TEMPLATE_LIBRARY_AUTH,
  TOPICS,
  USE_CASES,
} from './template-library.data';

@Injectable()
export class TemplateLibraryService {
  filters() {
    return { industries: INDUSTRIES, topics: TOPICS, useCases: USE_CASES };
  }

  search(params: {
    type?: string;
    search?: string;
    industry?: string[];
    topic?: string[];
    useCase?: string[];
    language?: string;
    page?: number;
    limit?: number;
  }) {
    const type = (params.type || 'UTILITY').toUpperCase();
    const source: LibraryTemplate[] =
      type === 'AUTHENTICATION' ? TEMPLATE_LIBRARY_AUTH : TEMPLATE_LIBRARY;

    let items = source;
    if (params.search) {
      const q = params.search.toLowerCase();
      items = items.filter(
        (t) => t.name.toLowerCase().includes(q) || t.body.toLowerCase().includes(q),
      );
    }
    if (params.industry?.length) {
      items = items.filter((t) => t.industry.some((i) => params.industry!.includes(i)));
    }
    if (params.topic?.length) {
      items = items.filter((t) => t.topic.some((i) => params.topic!.includes(i)));
    }
    if (params.useCase?.length) {
      items = items.filter((t) => t.useCase.some((i) => params.useCase!.includes(i)));
    }

    const total = items.length;
    const page = params.page || 1;
    const limit = params.limit || 12;
    const start = (page - 1) * limit;
    const paged = items.slice(start, start + limit);

    return { items: paged, total, page, limit };
  }

  get(id: string) {
    return (
      TEMPLATE_LIBRARY.find((t) => t.id === id) ||
      TEMPLATE_LIBRARY_AUTH.find((t) => t.id === id) ||
      null
    );
  }
}
