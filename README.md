# VnExpress 2045

A satirical, fictional edition of Vietnam's largest online newspaper — written as if published in **April 2045**, the year of the 100th anniversary of Vietnam's independence and the original deadline of the national "developed nation by 2045" goal.

**Live:** https://vnexpress45.nvbinh.com

Inspired by [HN35](https://news.ycombinator.com/item?id=46212180) (a fake Hacker News from 2035). The trick: keep the medium *exactly* as it is today — same layout, same red chrome, same comment culture — and let only the content drift 19 years into the future. The friction between the unchanged form and the changed world is the satire.

## The four-era timeline

This is one panel of a four-part project — the same newspaper, four moments in (real and imagined) time:

| Era | Site | Repo |
|---|---|---|
| ~Hùng Vương 18 (myth) | [vnexpress-vanlang.nvbinh.com](https://vnexpress-vanlang.nvbinh.com) | [vnexpress-vanlang](https://github.com/nvbinh15/vnexpress-vanlang) |
| 1985 (bao cấp) | [vnexpress1985.nvbinh.com](https://vnexpress1985.nvbinh.com) | [vnexpress-1985](https://github.com/nvbinh15/vnexpress-1985) |
| 2026 | the real vnexpress.net | — |
| **2045** | **this site** | this repo |
| 2045 (Gen-Z spin-off) | [kenh14-2045.nvbinh.com](https://kenh14-2045.nvbinh.com) | [kenh14-2045](https://github.com/nvbinh15/kenh14-2045) |

The thesis the timeline makes visible: the bureaucratic register ("đẩy mạnh", "tăng cường", "phấn đấu") and the gold-buying instinct are identical across ~4,900 years, while everything material transforms.

## Worldbuilding (three layers)

- **Backdrop catastrophes** (referenced casually, never explained): Đại hồng thủy 2034, Cú trượt dân số 2037, Luật AI 2042 / Chứng nhận Đan Sa, the "Lao động Hữu nghị" labor-import program, and the quietly postponed national goal ("Khát vọng 2050").
- **Mundane creeps** — the unpredictable-but-ordinary new normals: AI tutors in every home, co-sleeping rentals (ngủ ghép), inherited voices of the deceased in family group chats, rented relatives for Tết, climate work-permits, dormant personal AI agents, housing lotteries.
- **Cultural continuity** — what never changes: mom's marriage pressure, real-estate obsession, the annual đề thi văn outrage, bia hơi on plastic stools, floods, and the family Zalo group.

## Stack

Vite + React 19 + TypeScript + Tailwind. Articles are MDX with frontmatter; comments are per-article JSON; hero images are generated with `gpt-image-2` and converted to AVIF via `sharp` (`scripts/generate-images.mjs`, ~$0.04/image). Static SPA, deployed on Vercel.

```bash
npm install
npm run dev    # local
npm run build  # production build
```

## Disclaimer

**Đây là trang web hư cấu (satire).** All articles, people, comments, and images are fictional and AI-generated for a non-commercial creative project. Not affiliated with VnExpress or FPT. No real living person is depicted.
