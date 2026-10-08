# Recomputes, independently in R, the answer key of every generated question collected by check-keys.js
# (Units 2-6). Run: PORT=8201 NODE_PATH=... node tools/check-keys.js 40 | Rscript tools/check-keys.R
suppressMessages(library(jsonlite)); suppressMessages(library(lme4))
x <- fromJSON(file("stdin", encoding = "UTF-8"), simplifyVector = FALSE)
fails <- 0
check <- function(label, results) {
  r <- unlist(results); good <- sum(r); n <- length(r)
  if (good < n) fails <<- fails + 1
  cat(sprintf("%-5s %-62s %d/%d\n", if (good == n) "PASS" else "FAIL", label, good, n))
}
num <- function(v) as.numeric(unlist(v))
near <- function(a, b, tol = 1e-6) isTRUE(all(abs(a - b) < tol))
rmin <- function(s) as.numeric(gsub("[^0-9.]", "", s)) * ifelse(grepl("^[0-9]", s), 1, -1)   # a leading non-digit is the minus sign
pmfbb <- function(a, b) sapply(0:10, function(k) integrate(function(p) dbinom(k, 10, p) * dbeta(p, a, b), 0, 1, rel.tol = 1e-10)$value)
bracket <- function(P) { cs <- cumsum(P); c(which(cs >= 0.05 - 1e-12)[1] - 1, which(cs >= 0.95 - 1e-12)[1] - 1) }

# ---- Unit 2
check("u2-peak: argmax of dbeta x dbinom on the 0..1 grid (and prior / likelihood peaks)", lapply(x[["u2-peak"]], function(e) {
  ps <- (0:10) / 10; pr <- dbeta(ps, e$a0, e$b0); li <- dbinom(e$k, e$n, ps); po <- pr * li
  which.max(po) - 1 == e$ip && which.max(pr) - 1 == e$i0 && which.max(li) - 1 == e$il }))
check("u2-count: share of Beta(a,b) left of the line = pbeta", lapply(x[["u2-count"]], function(e) near(pbeta(e$cut, e$a, e$b), e$left, 1e-4)))
check("u2-predict: beta-binomial pmf by integration, bracket, mass", lapply(x[["u2-predict"]], function(e) {
  P <- pmfbb(e$a, e$b); br <- bracket(P); mean <- e$a / (e$a + e$b); pl <- bracket(dbinom(0:10, 10, mean))
  near(P, num(e$P), 1e-6) && e$a == e$a0 + e$k && e$b == e$b0 + e$n - e$k && br[1] == e$lo && br[2] == e$hi &&
    sum(P[(pl[1] + 1):(pl[2] + 1)]) <= 0.87 && all(pl == num(e$plug)) }))
check("u2-which: prior predictive wider than posterior wider than best-guess", lapply(x[["u2-which"]], function(e) {
  w <- function(P) { b <- bracket(P); b[2] - b[1] }
  w(pmfbb(e$a0, e$b0)) > w(pmfbb(e$a0 + e$k, e$b0 + e$n - e$k)) && w(pmfbb(e$a0 + e$k, e$b0 + e$n - e$k)) > w(dbinom(0:10, 10, e$k / e$n)) }))
check("u2-move: ratio of dbeta heights, and the up/down rule", lapply(x[["u2-move"]], function(e) {
  r <- dbeta(e$prop, e$a, e$b) / dbeta(e$cur, e$a, e$b); near(r, e$ratio, 1e-6) && (if (e$kind == "up") r >= 1.5 else r <= 0.25) }))

# ---- Unit 3
check("u3-mean: mean() and sd() of the dots", lapply(x[["u3-mean"]], function(e) near(mean(num(e$vals)), e$mean) && near(sd(num(e$vals)), e$sd)))
fitcheck <- function(e) { d <- data.frame(x = num(e$xs), y = num(e$ys)); f <- lm(y ~ x, d); near(coef(f)[[1]], e$a, 1e-6) && near(coef(f)[[2]], e$b, 1e-6) && (is.null(e$sigma) || near(sigma(f), e$sigma, 1e-6)) }
check("u3-fit: intercept, slope, sigma against lm()", lapply(x[["u3-fit"]], fitcheck))
check("u3-noise: intercept, slope, sigma against lm()", lapply(x[["u3-noise"]], fitcheck))
check("u3-prior: window ends give 99% and 90% of lines inside the frame", lapply(x[["u3-prior"]], function(e) {
  lo <- e$m / qnorm(0.995); hi <- e$m / qnorm(0.95)
  near(lo, e$lo, 1e-9) && near(hi, e$hi, 1e-9) && near(2 * pnorm(e$m / lo) - 1, 0.99, 1e-9) && near(2 * pnorm(e$m / hi) - 1, 0.90, 1e-9) }))
check("u3-table: estimates, 95% ends (est +/- 1.96 SE), sigma from lm()", lapply(x[["u3-table"]], function(e) {
  d <- data.frame(x = num(e$xs), y = num(e$ys)); f <- lm(y ~ x, d); s <- summary(f)$coefficients
  est <- c(coef(f)[[1]], coef(f)[[2]], sigma(f)); se <- c(s[1, 2], s[2, 2], sigma(f) / sqrt(2 * (nrow(d) - 2)))
  want <- unlist(lapply(1:3, function(i) c(est[i], est[i] - 1.96 * se[i], est[i] + 1.96 * se[i])))
  got <- rmin(unlist(e$table)); near(sort(got), sort(round(want, 2)), 0.0051 + 1e-9) && near(est, num(e$est), 1e-6) && near(se, num(e$se), 1e-6) }))
check("u3-fuzz: line SE largest at the far end, smallest at the data mean (lm se.fit)", lapply(x[["u3-fuzz"]], function(e) {
  d <- data.frame(x = num(e$xs), y = 0); d$y <- num(e$xs) * 0.5 + 0.1 * sin(seq_along(d$x)); f <- lm(y ~ x, d)
  g <- 0:40; se <- predict(f, data.frame(x = g), se.fit = TRUE)$se.fit
  far <- if (e$side == "right") 0 else 40
  g[which.max(se)] == far && abs(g[which.min(se)] - mean(d$x)) <= 0.5 && near(mean(d$x), e$xb, 1e-9) }))
check("u3-centre: fitted line passes through (mean x, mean y)", lapply(x[["u3-centre"]], function(e) {
  d <- data.frame(x = num(e$xs), y = num(e$ys)); f <- lm(y ~ x, d); near(predict(f, data.frame(x = mean(d$x))), mean(d$y), 1e-9) && near(mean(d$x), e$xb, 1e-9) && near(mean(d$y), e$yb, 1e-9) }))

# ---- Unit 4
post_mean <- function(ybar, n, mu, sigma, tau) (mu / tau^2 + n * ybar / sigma^2) / (1 / tau^2 + n / sigma^2)   # conjugate normal, variances known
check("u4-land: pooled position = conjugate normal posterior mean", lapply(x[["u4-land"]], function(e) near(post_mean(e$m, e$n, e$mu, e$sigma, e$tau), e$truth, 1e-9) && near(mean(num(e$obs)), e$m, 0.1) && near(sd(num(e$obs)), e$sigma, 0.15)))
check("u4-most: each tree's move, and the biggest mover", lapply(x[["u4-most"]], function(e) {
  mv <- sapply(e$rows, function(r) abs(r$m - post_mean(r$m, r$n, e$mu, e$sigma, e$tau))); pp <- sapply(e$rows, function(r) post_mean(r$m, r$n, e$mu, e$sigma, e$tau))
  which.max(mv) - 1 == e$win && near(pp, sapply(e$rows, function(r) r$p), 1e-9) && near(mv, sapply(e$rows, function(r) r$move), 1e-9) }))
check("u4-amount: shrinkage factor from lme4 (random-intercept fit) = 1 - w", lapply(x[["u4-amount"]], function(e) {
  G <- length(e$groups); d <- data.frame(y = unlist(lapply(e$groups, num)), g = factor(rep(1:G, each = length(e$groups[[1]]))))
  m <- suppressMessages(suppressWarnings(lmer(y ~ 1 + (1 | g), d, REML = TRUE))); mm <- tapply(d$y, d$g, mean)
  pooled <- fixef(m)[[1]] + ranef(m)$g[, 1]; w <- mean((pooled - mean(mm)) / (mm - mean(mm)))
  near(1 - w, e$s, 1e-3) && near(w, e$w, 1e-3) }))

# ---- Unit 5
CODES <- list("trt-A" = c(0, 1), "trt-B" = c(1, 0), sum = c(-1, 1), half = c(-0.5, 0.5), num = c(1, 2))
codefit <- function(e) { cc <- if (!is.null(e$cA)) c(e$cA, e$cB) else CODES[[e$coding]]; d <- data.frame(y = c(e$mA - 1, e$mA + 1, e$mB - 1, e$mB + 1), code = c(cc[1], cc[1], cc[2], cc[2])); coef(lm(y ~ code, d)) }
for (id in c("u5-intercept", "u5-slope", "u5-name")) check(sprintf("%s: intercept and slope from lm() on the numeric code", id), lapply(x[[id]], function(e) { b <- codefit(e); near(b[[1]], e$int, 1e-9) && near(b[[2]], e$slope, 1e-9) }))
check("u5-slope: height of the line at code 1 = intercept + slope", lapply(x[["u5-slope"]], function(e) { b <- codefit(e); near(b[[1]] + b[[2]], e$h1, 1e-9) }))
check("u5-*: R's own contrasts agree (treatment, and +/-1 sum coding)", lapply(x[["u5-intercept"]], function(e) {
  d <- data.frame(y = c(e$mA - 1, e$mA + 1, e$mB - 1, e$mB + 1), f = factor(rep(c("A", "B"), each = 2)))
  if (e$coding == "trt-A") { b <- coef(lm(y ~ f, d)); near(b[[1]], e$int, 1e-9) && near(b[[2]], e$slope, 1e-9) }
  else if (e$coding == "sum") { contrasts(d$f) <- cbind(c(-1, 1)); b <- coef(lm(y ~ f, d)); near(b[[1]], e$int, 1e-9) && near(b[[2]], e$slope, 1e-9) }
  else TRUE }))
check("u5-prior: window ends give 99% and 90% prior mass within +/- the biggest slope", lapply(x[["u5-prior"]], function(e) {
  tg <- e$c * e$D; lo <- tg / qnorm(0.995); hi <- tg / qnorm(0.95)
  near(tg, e$target, 1e-9) && near(lo, e$lo, 1e-9) && near(hi, e$hi, 1e-9) && near(2 * pnorm(tg / lo) - 1, 0.99, 1e-9) && near(2 * pnorm(tg / hi) - 1, 0.90, 1e-9) &&
    near(e$c, 1 / abs(CODES[[e$coding]][2] - CODES[[e$coding]][1]), 1e-9) }))

# ---- Unit 6
check("u6-share: prior share = weight of the prior mean in the posterior mean", lapply(x[["u6-share"]], function(e) {
  w <- (e$a0 + e$b0) / (e$a0 + e$b0 + e$n); pm <- (e$a0 + e$k) / (e$a0 + e$b0 + e$n); near(w, e$w, 1e-12) && near(pm, w * e$a0 / (e$a0 + e$b0) + (1 - w) * e$k / e$n, 1e-12) }))
check("u6-outgrow: smallest n (steps of 5) with the two posterior means within 3 points", lapply(x[["u6-outgrow"]], function(e) {
  gap <- function(n) { k <- e$p * n; abs((1 + k) / (2 + n) - (e$a + k) / (e$a + e$b + n)) }
  ns <- seq(5, 60, 5); s <- ns[which(sapply(ns, gap) <= 0.03)[1]]; s == e$nStar && near(e$a + e$b - 2 + 2, e$a + e$b) }))
check("u6-trace / u6-rhat: no numeric key (pictures and thresholds); ESS and Rhat ranges", lapply(x[["u6-rhat"]], function(e) { r <- num(e$rhat); e$badRow + 1 == which.max(r) && sum(r > 1.05) == 1 }))
cat(if (fails) sprintf("\n%d check group(s) FAILED\n", fails) else "\nall key checks passed\n"); quit(status = if (fails) 1 else 0)
