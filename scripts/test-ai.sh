#!/bin/bash
echo "TEST 1: 違 là gì"
curl -s -m 60 -X POST http://127.0.0.1:4000/api/ai/chat -H "Content-Type: application/json" -d '{"model":"nemotron-3-super:cloud","messages":[{"role":"user","content":"Kanji 違 có nghĩa là gì? Trả lời 1 câu ngắn bằng tiếng Việt."}],"stream":false}'
echo ""
echo "TEST 2: Onyomi"
curl -s -m 60 -X POST http://127.0.0.1:4000/api/ai/chat -H "Content-Type: application/json" -d '{"model":"nemotron-3-super:cloud","messages":[{"role":"user","content":"Onyomi của kanji 違 là gì? Trả lời ngắn."}],"stream":false}'
echo ""
echo "TEST 3: Kunyomi"
curl -s -m 60 -X POST http://127.0.0.1:4000/api/ai/chat -H "Content-Type: application/json" -d '{"model":"nemotron-3-super:cloud","messages":[{"role":"user","content":"Kunyomi của kanji 違 là gì? Trả lời ngắn."}],"stream":false}'
echo ""
echo "TEST 4: JLPT"
curl -s -m 60 -X POST http://127.0.0.1:4000/api/ai/chat -H "Content-Type: application/json" -d '{"model":"nemotron-3-super:cloud","messages":[{"role":"user","content":"Kanji 違 thuộc cấp độ JLPT nào?"}],"stream":false}'
echo ""
echo "TEST 5: Ví dụ"
curl -s -m 60 -X POST http://127.0.0.1:4000/api/ai/chat -H "Content-Type: application/json" -d '{"model":"nemotron-3-super:cloud","messages":[{"role":"user","content":"Cho 1 ví dụ từ vựng chứa kanji 違 với hiragana và nghĩa."}],"stream":false}'
echo ""