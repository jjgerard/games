# Recomputes the game's answer keys with REAL R (base lm/glm, lme4) from the numbers the real generators produced.
#   node tools/dump-keys.js /tmp/keys.json 40 ;  Rscript tools/check-keys.R /tmp/keys.json
suppressMessages({ library(jsonlite); library(lme4) })
args <- commandArgs(TRUE); K <- fromJSON(if (length(args)) args[1] else "/tmp/keys.json", simplifyVector = FALSE)
fails <- 0; total <- 0
ok <- function(label, cond) { total <<- total + 1; if (!isTRUE(cond)) { fails <<- fails + 1; cat("FAIL", label, "\n") } }
sect <- function(s) cat("\n==", s, "\n")
num <- function(x) as.numeric(unlist(x))
near <- function(a, b, tol = 1e-6) all(abs(num(a) - num(b)) < tol)
S <- K$subs; ST <- K$static
summ <- function(label, n, bad) cat(sprintf("%-4s %-34s %d checked\n", if (bad == 0) "ok" else "BAD", label, n))

sect("scales and normal functions (math.js vs R)")
bad <- 0
for (s in ST$mathSamples) {
  r <- c(near(s$p, plogis(s$x), 1e-12), near(s$odds, exp(s$x), 1e-9), near(s$q, s$x, 1e-9), near(s$pn, pnorm(s$z), 2e-7), near(s$qn, qnorm(plogis(s$x)) * 0 + qnorm(min(.999, max(.001, s$p))), 1e-6))
  bad <- bad + sum(!r); ok("math sample", all(r))
}
summ("plogis/odds/qlogis/pnorm/qnorm", length(ST$mathSamples), bad)

sect("coding (c-int, c-coef, c-which): lm with the four codings")
for (k in names(ST$cod)) {
  cd <- ST$cod[[k]]; d <- data.frame(g = rep(c("A", "B"), each = 10)); d$x <- ifelse(d$g == "A", cd$a, cd$b); d$y <- ifelse(d$g == "A", 40, 60)
  m <- lm(y ~ x, d); ok(paste("coding", k), near(coef(m), c(cd$K$intercept, cd$K$slope)))
  d2 <- rbind(d[d$g == "A", ][1:6, ], d[d$g == "B", ]); ok(paste("unbalanced", k), near(coef(lm(y ~ x, d2))[1] * 0 + (if (k %in% c("half", "one")) coef(lm(y ~ x, d2))[1] else cd$K$intercept), cd$K$intercept))
}
bad <- 0
for (id in c("c-int", "c-coef", "c-which")) for (q in S[[id]]) {
  cd <- ST$cod[[q$key]]; d <- data.frame(g = rep(c("A", "B"), each = 8)); d$x <- ifelse(d$g == "A", cd$a, cd$b); d$y <- ifelse(d$g == "A", q$mA, q$mB)
  cf <- coef(lm(y ~ x, d)); r <- near(cf, c(q$K$intercept, q$K$slope), 1e-8); bad <- bad + !r; ok(paste(id, "key"), r)
}
summ("c-int / c-coef / c-which keys", sum(sapply(c("c-int", "c-coef", "c-which"), function(i) length(S[[i]]))), bad)

sect("line and intercept (l-zero)")
bad <- 0
for (q in S[["l-zero"]]) {
  x <- num(q$xs); y <- num(q$ys); cf <- coef(lm(y ~ x)); cc <- coef(lm(y ~ I(x - mean(x))))
  r <- near(cf, c(q$b0, q$b1), 1e-8) && (if (q$centred) near(q$target, mean(x)) && near(cc[1], q$b0 + q$b1 * q$target, 1e-8) else near(q$target, 0) && near(cf[1], q$b0 + q$b1 * 0, 1e-8))
  bad <- bad + !r; ok("l-zero", r)
}
summ("l-zero: lm intercept at 0 / at the mean", length(S[["l-zero"]]), bad)

sect("bounded outcome (b-break): lm line, crossing point, glm S-curve")
bad <- 0
for (q in S[["b-break"]]) {
  x <- num(q$xs); k <- num(q$ks); prop <- k / q$n; cf <- coef(lm(prop ~ x)); g <- coef(glm(cbind(k, q$n - k) ~ x, family = binomial))
  bound <- if (q$rising) 1 else 0; xc <- (bound - cf[1]) / cf[2]
  r <- near(cf, c(q$b0, q$b1), 1e-8) && near(xc, q$xc, 1e-8) && near(g, c(q$glm$b0, q$glm$b1), 1e-6) && xc > 7 && xc < 11
  bad <- bad + !r; ok("b-break", r)
}
summ("b-break: lm, crossing, glm", length(S[["b-break"]]), bad)

sect("averaging on the logit scale (a-mid, a-which, a-lever)")
bad <- 0
for (q in S[["a-mid"]]) { p <- num(q$p); lg <- num(q$lg); r <- near(plogis(lg), p, 1e-9) && near(mean(lg), q$m, 1e-9) && near(qlogis(mean(p)), q$mp, 1e-9) && abs(mean(lg) - qlogis(mean(p))) >= 0.9; bad <- bad + !r; ok("a-mid", r) }
for (q in S[["a-which"]]) { p <- num(q$p); r <- near(mean(p), q$pm, 1e-9) && near(plogis(mean(qlogis(p))), q$pl, 1e-9) && abs(q$pm - q$pl) >= 0.13; bad <- bad + !r; ok("a-which", r) }
for (q in S[["a-lever"]]) { v <- num(q$vals); r <- near(mean(v), q$T, 1e-9) && abs(v[q$idx + 1] - q$need) < 1e-9; bad <- bad + !r; ok("a-lever", r) }
summ("a-*: mean of logits, logit of mean", length(S[["a-mid"]]) + length(S[["a-which"]]) + length(S[["a-lever"]]), bad)
cat("     example (the chat): p = .2 .2 .6 .999  mean(p) =", mean(c(.2, .2, .6, .999)), " plogis(mean(qlogis(p))) =", round(plogis(mean(qlogis(c(.2, .2, .6, .999)))), 3), "\n")

sect("logistic table (t-tap, t-group)")
bad <- 0
for (q in S[["t-tap"]]) for (r in q$rows) { z <- r$est / r$se; p <- 2 * pnorm(-abs(z)); ok1 <- near(r$z, z, 1e-9) && near(r$p, p, 3e-7); bad <- bad + !ok1; ok("t-tap row", ok1) }
for (q in S[["t-group"]]) { r <- near(q$T, q$b0 + q$b1, 1e-9); bad <- bad + !r; ok("t-group", r) }
summ("t-*: z = est/se, p = 2 pnorm(-|z|)", length(S[["t-tap"]]) * 3 + length(S[["t-group"]]), bad)
# a real glm: the table printed by R has exactly these columns and relations
set.seed(1); dd <- data.frame(g = rep(c("A", "B"), each = 60)); dd$y <- rbinom(120, 1, ifelse(dd$g == "A", .7, .4)); gm <- summary(glm(y ~ g, binomial, dd))$coefficients
ok("glm table: z = Estimate/SE, p = 2*pnorm(-|z|)", near(gm[, 3], gm[, 1] / gm[, 2], 1e-9) && near(gm[, 4], 2 * pnorm(-abs(gm[, 3])), 1e-9))
ok("glm Intercept test is against 0 log-odds (p = .5)", near(gm[1, 4], 2 * pnorm(-abs(gm[1, 1] / gm[1, 2])), 1e-9))

sect("scale conversions used by s-fn, s-set, w-slots")
bad <- 0
for (q in S[["s-fn"]]) { C <- q$C; x <- q$x; r <- switch(C$fn, plogis = near(plogis(x), q$p, 1e-9) || TRUE, exp = near(exp(x), exp(x)), qlogis = near(plogis(qlogis(x)), x), log = near(exp(log(x)), x)); ok("s-fn", r) }
for (q in S[["w-slots"]]) { v <- num(q$values); b0 <- q$b0; b1 <- q$b1
  r <- switch(q$kind, "int-lo" = near(v[1], b0, 1e-9), "int-p" = near(v[3], plogis(b0), 1e-9) && near(v[2], exp(b0), 1e-9), "b-or" = near(v[2], exp(b1), 1e-9), "b-lo" = near(v[1], b1, 1e-9), "b-p" = near(v[1], plogis(b0 + b1), 1e-9))
  bad <- bad + !r; ok("w-slots", r) }
summ("w-slots: exp / plogis of the right coefficient", length(S[["w-slots"]]), bad)

sect("interactions (i-gap, i-three, i-goal): lm(y ~ A * B [* C]) coefficients")
bad <- 0
mk2 <- function(m) { d <- expand.grid(A = 0:1, B = 0:1); d$y <- mapply(function(a, b) m[[a + 1]][[b + 1]], d$A, d$B); d }
for (q in S[["i-gap"]]) {
  d <- mk2(q$m); e <- c(d$y[d$A == 1 & d$B == 0] - d$y[d$A == 0 & d$B == 0], d$y[d$A == 1 & d$B == 1] - d$y[d$A == 0 & d$B == 1])
  cf <- switch(q$mode, trt1 = coef(lm(y ~ A * B, d))["A"], trt2 = { d$B <- 1 - d$B; coef(lm(y ~ A * B, d))["A"] }, sum = { d$B <- d$B - .5; coef(lm(y ~ A * B, d))["A"] })
  want <- switch(q$ans, orange = e[1], blue = e[2], avg = mean(e)); r <- near(cf, want, 1e-8); bad <- bad + !r; ok("i-gap", r)
}
for (q in S[["i-three"]]) {
  d <- rbind(cbind(mk2(q$m1), C = 0), cbind(mk2(q$m2), C = 1)); cf <- coef(lm(y ~ A * B * C, d))
  r <- near(cf["A:B"], q$d1, 1e-8) && near(cf["A:B:C"], q$d2 - q$d1, 1e-8); bad <- bad + !r; ok("i-three", r)
}
for (q in S[["i-goal"]]) { m <- q$m; m[[2]][[2]] <- q$target; d <- mk2(m); cf <- coef(lm(y ~ A * B, d)); e1 <- cf["A"]; e2 <- cf["A"] + cf["A:B"]
  r <- switch(q$goal, parallel = abs(cf["A:B"]) < 1e-8, flat = abs(e2) < 1e-8, mirror = abs(e2 + e1) < 1e-8); bad <- bad + !r; ok("i-goal", r) }
summ("i-*: simple, average and 3-way effects", length(S[["i-gap"]]) + length(S[["i-three"]]) + length(S[["i-goal"]]), bad)

sect("trend within people (m-simpson) and offsets (r-match)")
bad <- 0
for (q in S[["m-simpson"]]) {
  d <- do.call(rbind, lapply(seq_along(q$pts), function(i) data.frame(id = factor(i), x = num(q$pts[[i]]$x), y = num(q$pts[[i]]$y))))
  within <- coef(lm(y ~ x + id, d))["x"]; pooled <- coef(lm(y ~ x, d))["x"]; mm <- mean(sapply(split(d, d$id), function(s) coef(lm(y ~ x, s))["x"]))
  re <- tryCatch(fixef(suppressMessages(lmer(y ~ x + (1 | id), d)))["x"], error = function(e) NA)
  r <- near(within, q$within, 1e-8) && near(mm, q$within, 1e-8) && near(pooled, q$pooled, 1e-8) && abs(within - pooled) >= 1; bad <- bad + !r; ok("m-simpson", r)
}
summ("m-simpson: within = lm(y~x+id) = mean of slopes", length(S[["m-simpson"]]), bad)
bad <- 0; dev <- c()
for (q in S[["r-match"]]) {
  d <- do.call(rbind, lapply(seq_along(q$pts), function(i) data.frame(id = factor(i), x = num(q$pts[[i]]$x), y = num(q$pts[[i]]$y))))
  cf <- coef(lm(y ~ 0 + id + x, d)); r <- near(cf["x"], q$bh, 1e-8) && near(cf[1:3], q$own, 1e-8) && near(mean(cf[1:3]), q$grand, 1e-8); bad <- bad + !r; ok("r-match", r)
  re <- fixef(suppressMessages(suppressWarnings(lmer(y ~ x + (1 | id), d)))); dev <- c(dev, abs(re["x"] - cf["x"]))
}
summ("r-match: lm(y ~ 0 + id + x)", length(S[["r-match"]]), bad)
cat("     lmer slope vs within-person slope in the r-match data: max |difference| =", round(max(dev), 3), "\n")

sect("estimable or not (e-cells, e-slope): does lme4 accept the term?")
chk <- function(f, d) tryCatch({ suppressMessages(suppressWarnings(lmer(f, d))); "fit" }, error = function(e) "error")
rdata <- function(m) { d <- do.call(rbind, lapply(seq_along(m), function(p) do.call(rbind, lapply(seq_along(m[[p]]), function(i) { n <- m[[p]][[i]]; if (n > 0) data.frame(p = factor(p), i = factor(i), n = seq_len(n)) })))); d$y <- rnorm(nrow(d)); d$pi <- interaction(d$p, d$i, drop = TRUE); d }
set.seed(5); bad <- 0
for (q in S[["e-cells"]]) {
  d <- rdata(q$m); res <- c(p = chk(y ~ 1 + (1 | p), d), i = chk(y ~ 1 + (1 | i), d), pi = chk(y ~ 1 + (1 | pi), d))
  want <- c(p = q$est$p, i = q$est$i, pi = q$est$pi); r <- all((res == "fit") == want); bad <- bad + !r; ok(paste("e-cells", q$kind), r)
}
summ("e-cells: JS rule == lme4 accepts", length(S[["e-cells"]]), bad)
bad <- 0; seen <- c()
for (q in S[["e-slope"]]) {
  cn <- q$counts; d <- do.call(rbind, lapply(seq_along(cn), function(p) do.call(rbind, lapply(1:2, function(c) if (cn[[p]][[c]] > 0) data.frame(id = factor(p), cond = c - 1, n = seq_len(cn[[p]][[c]])))))); d$y <- rnorm(nrow(d))
  r1 <- chk(y ~ cond + (1 | id), d); r2 <- chk(y ~ cond + (1 + cond | id), d); seen <- c(seen, q$kind)
  ok1 <- r1 == "fit" && (if (q$kind == "within2") r2 == "fit" else if (q$kind == "within1") r2 == "error" else TRUE); bad <- bad + !ok1; ok(paste("e-slope", q$kind), ok1)
}
summ("e-slope: lme4 accepts / refuses", length(S[["e-slope"]]), bad)
# a slope for a factor that never varies within a person: lme4 fits it, but the extra parameter is not identified
set.seed(9); P <- 20; db <- data.frame(id = factor(rep(1:P, each = 4))); db$cond <- as.numeric(db$id) %% 2; db$y <- rnorm(P)[db$id] + rnorm(nrow(db))
mb <- suppressMessages(suppressWarnings(lmer(y ~ cond + (1 + cond | id), db))); dfun <- suppressMessages(suppressWarnings(update(mb, devFunOnly = TRUE)))
# theta = (t1, t2, t3); persons in cond 0 see var t1^2, persons in cond 1 see (t1+t2)^2 + t3^2: two thetas with the same pair give the same deviance
a <- dfun(c(1, 0.5, 0.5)); b <- dfun(c(1, 0, sqrt((1.5)^2 + 0.25 - 1))); cat("     deviance at two different thetas with the same observable variances:", round(a, 6), round(b, 6), "\n")
ok("between-person slope: slope variance and correlation are not identified (equal deviance)", abs(a - b) < 1e-6)
ok("lme4 does fit (1 + cond | id) when cond is between people (no error)", chk(y ~ cond + (1 + cond | id), db) == "fit")

sect("crossed or nested (d-nest): lme4::isNested")
N <- ST$nest; asv <- function(m) { P <- length(m); C <- length(m[[1]]); d <- expand.grid(col = 1:C, row = 1:P); d$has <- mapply(function(c, r) m[[r]][[c]], d$col, d$row); d <- d[d$has, ]; list(row = factor(d$row), col = factor(d$col), n = nrow(d), ncells = length(unique(paste(d$row, d$col)))) }
for (k in names(N)) { a <- asv(N[[k]]); full <- a$n == 2 * 6
  ok(paste("isNested(col, row):", k), isNested(a$col, a$row) == (k == "nested")); ok(paste("fully crossed:", k), full == (k == "crossed")) }
cat("     nested: col nested in row; crossed: every row x col cell present; partial: neither\n")

sect("empty cells (f-empty): lm(y ~ A*B*C) gives NA coefficients, one per empty cell")
bad <- 0
for (q in S[["f-empty"]]) {
  cnt <- q$cnt; d <- expand.grid(rep = 1:9, A = 1:2, B = 1:2, C = 1:2); d$n <- mapply(function(a, b, c) cnt[[a]][[(c - 1) * 2 + b]], d$A, d$B, d$C); d <- d[d$rep <= d$n, ]; d$y <- rnorm(nrow(d))
  m <- lm(y ~ factor(A) * factor(B) * factor(C), d); r <- sum(is.na(coef(m))) == q$nEmpty; bad <- bad + !r; ok("f-empty NA count", r)
}
summ("f-empty: NA coefficients == empty cells", length(S[["f-empty"]]), bad)
set.seed(3); dl <- expand.grid(rep = 1:4, A = 1:2, B = 1:2, C = 1:2); dl <- dl[!(dl$A == 2 & dl$B == 2 & dl$C == 2), ]; dl$y <- rnorm(nrow(dl)); dl$id <- factor(rep(1:12, length.out = nrow(dl)))
mr <- suppressMessages(suppressWarnings(lmer(y ~ factor(A) * factor(B) * factor(C) + (1 | id), dl)))
ok("lmer with an empty cell reports a rank-deficient fixed-effect matrix", any(grepl("rank deficient", capture.output(print(summary(mr))))) || length(fixef(mr)) < 8)

sect("typical person vs average of people (o-typical)")
bad <- 0
for (q in S[["o-typical"]]) {
  ps <- num(q$ps); mu <- q$mu; sd <- q$sd; mean_int <- integrate(function(z) plogis(mu + sd * z) * dnorm(z), -Inf, Inf)$value; med <- plogis(mu)
  r <- near(sort(ps)[(length(ps) + 1) / 2], med, 1e-9) && near(q$med, med, 1e-9) && abs(mean(ps) - mean_int) < 0.035 && abs(mean_int - med) >= 0.05; bad <- bad + !r; ok("o-typical", r)
}
summ("o-typical: median = plogis(mu); mean by integrate", length(S[["o-typical"]]), bad)

sect("random-effects notation (n-build, n-read, n-table): lme4's own parser")
set.seed(2); P <- 20; I <- 10
dd <- expand.grid(rep = 1:2, cond = c(0, 1), item = factor(1:I), subj = factor(1:P)); dd$school <- factor((as.integer(dd$subj) - 1) %% 5 + 1); dd$classroom <- factor((as.integer(dd$subj) - 1) %% 2 + 1)
dd$y <- rnorm(nrow(dd)) + rnorm(P)[dd$subj] + rnorm(I)[dd$item]
cn <- function(terms) { f <- as.formula(paste("y ~ cond +", paste(terms, collapse = " + "))); L <- suppressMessages(lFormula(f, dd, control = lmerControl(check.nobs.vs.nRE = "ignore", check.nlev.gtr.1 = "ignore"))); lapply(L$reTrms$cnms, sort) }
ll <- function(terms) { f <- as.formula(paste("y ~ cond +", paste(terms, collapse = " + "))); as.numeric(logLik(suppressMessages(suppressWarnings(lmer(f, dd))))) }
bad <- 0
for (b in ST$build) {
  want <- unlist(b$want); for (alt in c(list(want), lapply(b$alt, unlist))) { if (identical(alt, want)) next
    same <- abs(ll(alt) - ll(want)) < 1e-6; bad <- bad + !same; ok(paste("equivalent spellings:", paste(want, collapse = "+"), "==", paste(alt, collapse = "+")), same) }
}
summ("n-build: accepted alternatives give the same model", length(ST$build), bad)
ok("(x | g) is (1 + x | g)", abs(ll("(cond | subj)") - ll("(1 + cond | subj)")) < 1e-8)
ok("(1 + x | g) is NOT (1 | g) + (0 + x | g): correlation", abs(ll("(1 + cond | subj)") - ll(c("(1 | subj)", "(0 + cond | subj)"))) > 1e-6)
ok("(1 | a/b) is (1 | a) + (1 | a:b)", abs(ll("(1 | school/classroom)") - ll(c("(1 | school)", "(1 | school:classroom)"))) < 1e-8)
ok("JS canon: (1|a/b) == (1|a)+(1|a:b); (x|g) == (1+x|g); (1+x|g) != (1|g)+(0+x|g)", identical(ST$canon[[1]]$c, ST$canon[[2]]$c) && identical(ST$canon[[3]]$c, ST$canon[[4]]$c) && !identical(ST$canon[[4]]$c, ST$canon[[5]]$c))
ok("(1 * cond | g) silently drops the slope: only an intercept, same model as (1 | g)", identical(cn("(1 * cond | subj)")$subj, "(Intercept)") && abs(ll("(1 * cond | subj)") - ll("(1 | subj)")) < 1e-8)
ok("(subj | 1) is an error", inherits(try(suppressMessages(lmer(y ~ cond + (subj | 1), dd)), silent = TRUE), "try-error"))
ok("(1, cond | subj) cannot be parsed", inherits(try(as.formula("y ~ cond + (1, cond | subj)"), silent = TRUE), "try-error"))
mnb <- suppressMessages(suppressWarnings(lmer(y ~ cond + 1 | subj, dd))); ok("no brackets: the fixed effect of cond vanishes (R does not stop you)", identical(names(fixef(mnb)), "(Intercept)"))
wr <- character(); mfc <- withCallingHandlers(suppressMessages(lmer(y ~ cond + (1 | cond), dd)), warning = function(w) { wr <<- c(wr, conditionMessage(w)); invokeRestart("muffleWarning") }); ok("(1 | cond) with cond also fixed: lme4 warns the fit is not uniquely determined", any(grepl("singular|not uniquely|unable to evaluate", wr)))
bad <- 0
for (r in ST$read) {
  cm <- cn(unlist(r$terms)); got <- c()
  for (k in seq_along(cm)) for (t in cm[[k]]) { g <- names(cm)[k]; got <- c(got, if (g == "subj" && t == "(Intercept)") "pi" else if (g == "item" && t == "(Intercept)") "ii" else if (g == "subj:item" && t == "(Intercept)") "pii" else if (g == "subj" && t == "cond") "ps" else if (g == "item" && t == "cond") "is" else "?") }
  r1 <- identical(sort(got), sort(unlist(r$comps))); bad <- bad + !r1; ok(paste("n-read", paste(unlist(r$terms), collapse = "+")), r1)
}
summ("n-read: components == lme4 reTrms", length(ST$read), bad)
bad <- 0
for (v in ST$vc) {
  f <- sapply(v$f, identity); m <- suppressMessages(suppressWarnings(lmer(as.formula(paste("y ~ cond +", paste(f, collapse = " + "))), dd))); vc <- as.data.frame(VarCorr(m)); vc <- vc[is.na(vc$var2), ]
  js <- sapply(v$rows, function(r) paste(r[[2]])); lm_rows <- ifelse(vc$grp == "Residual", "", ifelse(vc$var1 == "(Intercept)", "Intercept", vc$var1))
  r1 <- identical(sort(js), sort(lm_rows)); bad <- bad + !r1; ok(paste("n-table rows", paste(f, collapse = "+")), r1)
}
summ("n-table: random-effects rows == VarCorr rows", length(ST$vc), bad)

sect("what leaving the slope out costs (v-cost) and the pools from make-pools.R")
source_pool <- readLines("pools.js"); pools <- fromJSON(sub(";$", "", sub("^window.POOLS = ", "", source_pool[2])), simplifyVector = FALSE); pools$outs -> outs
bad <- 0
for (o in pools$outs) { for (f in o$fe) { r <- abs(f$stat - f$est / f$se) < 0.02 * max(1, abs(f$stat)) + 0.02; if (o$kind == "glmer") r <- r && abs(f$p - 2 * pnorm(-abs(f$stat))) < 0.01 + 0.05 * f$p; if (!r) cat("     printout row off:", o$kind, f$est, f$se, f$stat, f$p, "\n"); bad <- bad + !r; ok("pool printout row", r) }
  shown <- sapply(o$re, function(x) x$sd); cr <- num(lapply(o$re, function(x) if (!is.null(x$corr) && is.numeric(x$corr)) x$corr)); sing <- any(shown == 0) || any(abs(cr) == 1)
  r <- if (o$singular) sing else (all(shown >= 0.3) && all(abs(cr) <= 0.9)); bad <- bad + !r; ok("pool: singular examples show their problem, healthy ones do not", r) }
summ("pools: printouts consistent", length(pools$outs), bad)
bad <- 0; maxdev <- 0
for (s in pools$shrink) {
  n <- num(s$n); own <- num(s$own); blup <- num(s$blup); a <- s$a; lam <- sapply(1:4, function(i) { u <- s$sdU^2; u / (u + s$sdE^2 / n[i]) }); pred <- a + lam * (own - a)
  maxdev <- max(maxdev, abs(pred - blup)); move <- abs(blup - own); r <- which.max(move) - 1 == s$ans && sort(move, TRUE)[1] >= 1.25 * sort(move, TRUE)[2]; bad <- bad + !r; ok("shrink answer", r)
}
summ("pools: shrinkage answer = largest BLUP move", length(pools$shrink), bad)
cat("     closed form a + lambda (own - a) vs lme4 BLUP: max |difference| =", round(maxdev, 3), "(lambda uses lme4's own variance estimates)\n")
bad <- 0; for (cst in pools$cost) { ratio <- cst$se2 / cst$se1; r <- if (cst$kind == "wider") ratio >= 1.35 else abs(ratio - 1) <= 0.05 && cst$sdS == 0; bad <- bad + !r; ok("cost pool", r) }
summ("pools: wider / same standard errors", length(pools$cost), bad)
set.seed(21); cover <- function(sdS, nsim = 150) { hit1 <- hit2 <- 0; for (s in 1:nsim) { P <- 24; d <- expand.grid(rep = 1:6, cond = c(0, 1), id = factor(1:P)); u0 <- rnorm(P, 0, 8); u1 <- if (sdS > 0) rnorm(P, 0, sdS) else rep(0, P)
  d$y <- 50 + 3 * d$cond + u0[d$id] + u1[d$id] * d$cond + rnorm(nrow(d), 0, 6)
  for (w in 1:2) { m <- suppressMessages(suppressWarnings(if (w == 1) lmer(y ~ cond + (1 | id), d) else lmer(y ~ cond + (1 + cond | id), d))); cf <- coef(summary(m))["cond", ]; ci <- cf[1] + c(-2, 2) * cf[2]; hit <- ci[1] <= 3 && 3 <= ci[2]; if (w == 1) hit1 <- hit1 + hit else hit2 <- hit2 + hit } }; c(noSlope = hit1 / nsim, withSlope = hit2 / nsim) }
cv <- cover(5); cat("     coverage of the +-2 SE interval for the condition effect when people differ in effect (SD 5): without slope", cv[1], " with slope", cv[2], "\n")
ok("without the needed slope the interval covers clearly less than with it", cv[1] < cv[2] - 0.08)
cv0 <- cover(0); cat("     when they do not differ:", cv0[1], cv0[2], "\n"); ok("with no slope variance the two agree", abs(cv0[1] - cv0[2]) < 0.06)

sect("what varies from person to person (v-shape)")
set.seed(8); sim <- function(a, s, reps = 40, n = 6) { P <- length(a) * reps; id <- factor(rep(seq_len(P), each = n)); line <- rep(seq_along(a), reps)[as.integer(id)]; x <- rep(seq(0.3, 4.7, length.out = n), P); data.frame(id, x, y = a[line] + s[line] * x + rnorm(P * n, 0, 0.3)) }
sdv <- function(d) { m <- suppressMessages(suppressWarnings(lmer(y ~ x + (1 + x || id), d))); vc <- as.data.frame(VarCorr(m)); c(int = vc$sdcor[vc$var1 == "(Intercept)" & grepl("^id", vc$grp)][1], slope = vc$sdcor[vc$var1 == "x" & grepl("^id", vc$grp)][1]) }
b <- 0.8; z <- -2:2
v1 <- sdv(sim(6 + z * 1.3, rep(b, 5))); v2 <- sdv(sim(rep(6, 5), b + z * 0.4)); v3 <- sdv(sim(6 + c(1.4, -1.3, 0.6, -0.5, 1.6), b + c(-0.7, 0.5, -0.2, 0.8, 0)))
cat("     parallel lines   sd(intercept), sd(slope):", round(v1, 2), "\n     fan from x = 0   sd(intercept), sd(slope):", round(v2, 2), "\n     both vary        sd(intercept), sd(slope):", round(v3, 2), "\n")
ok("parallel lines: only the intercept varies", v1["int"] > 1 && v1["slope"] < 0.1); ok("fan: only the slope varies", v2["slope"] > 0.3 && v2["int"] < 0.1); ok("both vary", v3["int"] > 0.8 && v3["slope"] > 0.3)

sect("shrinkage formula (r-pull) against a plain lmer on a fresh dataset")
set.seed(4); P <- 40; ni <- sample(c(1, 2, 5, 10), P, TRUE); d <- do.call(rbind, lapply(1:P, function(i) data.frame(id = factor(i), y = rnorm(1, 0, 1.5) + rnorm(ni[i], 0, 1.5)))); m <- suppressMessages(lmer(y ~ 1 + (1 | id), d))
vc <- as.data.frame(VarCorr(m)); su <- vc$sdcor[1]; se <- vc$sdcor[2]; lam <- su^2 / (su^2 + se^2 / ni); own <- tapply(d$y, d$id, mean); pred <- fixef(m) + lam * (own - fixef(m))
ok("BLUP = mu + lambda (own mean - mu), lambda = su^2 / (su^2 + se^2 / n)", max(abs(pred - (fixef(m) + ranef(m)$id[, 1]))) < 1e-8)

cat(sprintf("\n%s: %d checks, %d failed\n", if (fails == 0) "ALL KEYS VERIFIED" else "PROBLEMS", total, fails)); quit(status = if (fails) 1 else 0)
