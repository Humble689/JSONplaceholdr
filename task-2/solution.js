function lengthOfLongestSubstring(s) {
  let left = 0;
  let maxLen = 0;
  const seen = new Map();

  for (let right = 0; right < s.length; right++) {
    const c = s[right];

    if (seen.has(c) && seen.get(c) >= left) {
      left = seen.get(c) + 1;
    }

    seen.set(c, right);

    if (right - left + 1 > maxLen) {
      maxLen = right - left + 1;
    }
  }

  return maxLen;
}

console.log(lengthOfLongestSubstring("abcabcbb")); // 3
console.log(lengthOfLongestSubstring("bbbbb"));    // 1
console.log(lengthOfLongestSubstring("pwwkew"));   // 3
console.log(lengthOfLongestSubstring(""));         // 0

module.exports = { lengthOfLongestSubstring };
