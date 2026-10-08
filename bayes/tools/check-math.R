# Independent check of math.js: run `node tools/check-math.js | Rscript tools/check-math.R`
suppressMessages(library(jsonlite)); suppressMessages(library(lme4))
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

for (e in x$beta) {
  a <- e$args[[1]]; b <- e$args[[2]]
  ok(sprintf("beta(%g,%g) density at 0.1/0.3/0.5/0.8", a, b), all(abs(dbeta(c(.1, .3, .5, .8), a, b) - unlist(e$pdf)) < 1e-7))
  ok(sprintf("beta(%g,%g) mean", a, b), abs(a / (a + b) - e$mean) < 1e-12)
  if (a > 1 && b > 1) ok(sprintf("beta(%g,%g) mode", a, b), abs((a - 1) / (a + b - 2) - e$mode) < 1e-12)
  ok(sprintf("beta(%g,%g) cdf", a, b), all(abs(pbeta(c(.2, .5, .9), a, b) - unlist(e$cdf)) < 1e-5))
  ok(sprintf("beta(%g,%g) quantiles", a, b), all(abs(qbeta(c(.05, .5, .95), a, b) - unlist(e$q)) < 1e-4))
  ok(sprintf("beta(%g,%g) mass between .3 and .7", a, b), abs(pbeta(.7, a, b) - pbeta(.3, a, b) - e$mass) < 1e-5)
}
for (e in x$three) {
  ps <- unlist(e$args[[1]]); w <- unlist(e$args[[2]]); s <- unlist(e$args[[3]])
  lik <- sapply(ps, function(p) prod(ifelse(s == "c", p, 1 - p))); pr <- w / sum(w); post <- pr * lik / sum(pr * lik)
  ok("prior x likelihood = posterior", all(abs(post - unlist(e$value$post)) < 1e-9) && all(abs(lik - unlist(e$value$lik)) < 1e-9) && all(abs(pr - unlist(e$value$prior)) < 1e-9))
}

# ---- Units 2-6 helpers
n <- x$norm
ok("normal density", all(abs(dnorm(unlist(n$xs), 1, 2) - unlist(n$pdf)) < 1e-10))
ok("normal cdf", all(abs(pnorm(unlist(n$xs), 1, 2) - unlist(n$cdf)) < 1e-10))
ok("normal quantile", all(abs(qnorm(unlist(n$q), 1, 2) - unlist(n$quant)) < 1e-8))
for (e in x$bb) {
  a <- unlist(e$args); P <- sapply(0:a[1], function(k) integrate(function(p) dbinom(k, a[1], p) * dbeta(p, a[2], a[3]), 0, 1, rel.tol = 1e-10)$value)
  ok(sprintf("beta-binomial pmf n=%d a=%g b=%g (by integration)", a[1], a[2], a[3]), all(abs(P - unlist(e$pmf)) < 1e-7))
  ok(sprintf("binomial pmf n=%d p=%.2f", a[1], a[2] / (a[2] + a[3])), all(abs(dbinom(0:a[1], a[1], a[2] / (a[2] + a[3])) - unlist(e$bin)) < 1e-10))
  cs <- cumsum(P); ok(sprintf("90%% bracket n=%d a=%g b=%g", a[1], a[2], a[3]), all(c(which(cs >= .05 - 1e-12)[1] - 1, which(cs >= .95 - 1e-12)[1] - 1) == unlist(e$bracket)))
}
o <- x$ols; f <- lm(y ~ x, data.frame(x = unlist(o$x), y = unlist(o$y))); s <- summary(f)$coefficients
ok("ols intercept, slope, sigma", abs(coef(f)[[1]] - o$fit$a) < 1e-9 && abs(coef(f)[[2]] - o$fit$b) < 1e-9 && abs(sigma(f) - o$fit$sigma) < 1e-9)
ok("ols standard errors", abs(s[1, 2] - o$fit$seA) < 1e-9 && abs(s[2, 2] - o$fit$seB) < 1e-9)
sm <- x$sampler; ok("beta sampler mean and quantiles (40000 draws)", abs(sm$a / (sm$a + sm$b) - sm$mean) < 0.004 && all(abs(qbeta(c(.1, .5, .9), sm$a, sm$b) - unlist(sm$q)) < 0.006))
g <- x$anova$groups; d <- data.frame(y = unlist(lapply(g, unlist)), g = factor(rep(seq_along(g), each = length(g[[1]]))))
m <- suppressMessages(lmer(y ~ 1 + (1 | g), d, REML = TRUE)); mm <- tapply(d$y, d$g, mean)
ok("anova pooling weight matches lme4 shrinkage", abs(mean((fixef(m)[[1]] + ranef(m)$g[, 1] - mean(mm)) / (mm - mean(mm))) - x$anova$res$w) < 1e-4)
ok("anova variance components match lme4", abs(as.data.frame(VarCorr(m))$vcov[1] - x$anova$res$tau2) < 1e-4 && abs(sigma(m)^2 - x$anova$res$msw) < 1e-6)
for (e in x$shrink) { a <- unlist(e$args); ok(sprintf("shrinkage weight tau=%g sigma=%g n=%g (conjugate normal)", a[1], a[2], a[3]), abs((1 / a[1]^2) / (1 / a[1]^2 + a[3] / a[2]^2) - (1 - e$w)) < 1e-12) }
