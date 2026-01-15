interface CitationData {
  title: string;
  authors: string;
  year: number;
  journal?: string;
  volume?: string;
  pages?: string;
  doi?: string;
}

export function formatAPA(citation: CitationData): string {
  const authorList = citation.authors.split(', ');
  const formattedAuthors = authorList
    .map((author) => {
      const parts = author.trim().split(' ');
      const lastName = parts.pop();
      const initials = parts.map((p) => p[0] + '.').join(' ');
      return `${lastName}, ${initials}`;
    })
    .join(', ');

  let result = `${formattedAuthors} (${citation.year}). ${citation.title}.`;
  if (citation.journal) {
    result += ` ${citation.journal}`;
    if (citation.volume) result += `, ${citation.volume}`;
    if (citation.pages) result += `, ${citation.pages}`;
  }
  if (citation.doi) {
    result += ` https://doi.org/${citation.doi}`;
  }
  return result;
}

export function formatChicago(citation: CitationData): string {
  const authorList = citation.authors.split(', ');
  const firstAuthor = authorList[0].trim().split(' ');
  const lastName = firstAuthor.pop();
  const firstName = firstAuthor.join(' ');

  let result = `${lastName}, ${firstName}`;
  if (authorList.length > 1) result += `, et al`;
  result += `. "${citation.title}."`;
  if (citation.journal) {
    result += ` ${citation.journal}`;
    if (citation.volume) result += ` ${citation.volume}`;
    if (citation.pages) result += `: ${citation.pages}`;
  }
  result += ` (${citation.year}).`;
  return result;
}

export function formatMLA(citation: CitationData): string {
  const authorList = citation.authors.split(', ');
  const firstAuthor = authorList[0].trim().split(' ');
  const lastName = firstAuthor.pop();
  const firstName = firstAuthor.join(' ');

  let result = `${lastName}, ${firstName}`;
  if (authorList.length > 1) result += `, et al`;
  result += `. "${citation.title}."`;
  if (citation.journal) {
    result += ` ${citation.journal}`;
    if (citation.volume) result += `, vol. ${citation.volume}`;
    if (citation.pages) result += `, pp. ${citation.pages}`;
  }
  result += `, ${citation.year}.`;
  return result;
}

export function formatBibTeX(citation: CitationData): string {
  const key = citation.title.toLowerCase().replace(/\s+/g, '_').slice(0, 20);
  return `@article{${key},
  title = {${citation.title}},
  author = {${citation.authors}},
  year = {${citation.year}},
  journal = {${citation.journal || ''}},
  volume = {${citation.volume || ''}},
  pages = {${citation.pages || ''}},
  doi = {${citation.doi || ''}}
}`;
}
