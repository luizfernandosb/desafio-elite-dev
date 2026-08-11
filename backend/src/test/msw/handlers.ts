import { http, HttpResponse } from 'msw'

export const TMDB_MOVIE = {
  id: 603,
  title: 'The Matrix',
  tagline: 'Bem-vindo ao mundo real.',
  overview: 'Um hacker descobre a verdade sobre a sua realidade.',
  poster_path: '/matrix.jpg',
  runtime: 136,
  genres: [
    { id: 28, name: 'Ação' },
    { id: 878, name: 'Ficção científica' },
  ],
}

export const handlers = [
  http.get('https://api.themoviedb.org/3/search/movie', ({ request }) => {
    const query = new URL(request.url).searchParams.get('query')

    if (query?.toLowerCase() === 'matrix') {
      return HttpResponse.json({
        results: [
          {
            id: TMDB_MOVIE.id,
            title: TMDB_MOVIE.title,
            overview: TMDB_MOVIE.overview,
            poster_path: TMDB_MOVIE.poster_path,
            genre_ids: TMDB_MOVIE.genres.map((genre) => genre.id),
          },
        ],
        total_results: 1,
        total_pages: 1,
      })
    }

    return HttpResponse.json({ results: [], total_results: 0, total_pages: 0 })
  }),

  http.get('https://api.themoviedb.org/3/movie/:id', ({ params }) => {
    if (params.id === String(TMDB_MOVIE.id)) return HttpResponse.json(TMDB_MOVIE)
    return HttpResponse.json({ status_message: 'not found' }, { status: 404 })
  }),

  http.get('https://api.themoviedb.org/3/genre/movie/list', () =>
    HttpResponse.json({ genres: TMDB_MOVIE.genres }),
  ),
]
