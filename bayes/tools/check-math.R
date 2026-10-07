# Independent check of math.js: run `node tools/check-math.js | Rscript tools/check-math.R`
suppressMessages(library(jsonlite))
x <- fromJSON(file("stdin"), simplifyVector = FALSE)
ok <- function(label, cond) cat(sprintf("%-4s %s\n", if (isTRUE(cond)) "PASS" else "FAIL", label))
lik <- function(p, s) if (s == "c") p else 1 - p
for (e in x$posteriorA) {
  a <- e$args; pA <- a[[1]]; pB <- a[[2]]; nA <- a[[3]]; nB <- a[[4]]; s <- unlist(a[[5]])
  num <- nA * prod(sapply(s, function(z) lik(pA, z))); den <- num + nB * prod(sapply(s, function(z) lik(pB, z)))
  ok(sprintf("posteriorA %s", paste(unlist(a[1:4]), collapse = "/")), abs(num / den - e$value) < 1e-9)
}
for (e in x$grid) {
  ps <- unlist(e$args[[1]]); k <- e$args[[2]]; n <- e$args[[3]]
  w <- dbinom(k, n, ps); r <- w / sum(w)
  ok(sprintf("grid k=%d n=%d", k, n), all(abs(r - unlist(e$value)) < 1e-9))
}
for (e in x$coverage) {
  p <- e$args[[1]]; n <- e$args[[2]]; band <- e$args[[3]]
  k <- 0:n; r <- sum(dbinom(k, n, p)[abs(k / n - p) <= band + 1e-9])
  ok(sprintf("coverage p=%.1f n=%d band=%.2f (%.3f)", p, n, band, r), abs(r - e$value) < 1e-9)
}
for (e in x$shelf) {
  ok(sprintf("shelf counts agree with posterior (%s)", paste(unlist(e$args), collapse = " ")),
     abs(e$value$fromA / (e$value$fromA + e$value$fromB) - e$post) < 1e-9)
}
