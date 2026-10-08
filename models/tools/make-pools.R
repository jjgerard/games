# Builds pools.js: model fits made with real lme4, so that every number the game shows in an lmer/glmer
# printout, every shrinkage position and every standard error comes from a real fit, not from a formula.
#   Rscript tools/make-pools.R        (run from models/; takes about a minute)
suppressMessages({ library(lme4); library(jsonlite) })
r2 <- function(x, d = 2) round(as.numeric(x), d)
sing_info <- function(m) {
  vc <- as.data.frame(VarCorr(m)); sds <- vc$sdcor[is.na(vc$var2) & vc$grp != "Residual"]
  cors <- vc$sdcor[!is.na(vc$var2)]
  list(zeroSD = any(sds < 1e-4, na.rm = TRUE), corr1 = any(abs(cors) > 0.9999, na.rm = TRUE))
}

## ---------- 1. printouts: lmer / glmer fits shown as drawn tables -----------
set.seed(2025)
outs <- list(); tries <- 0
nS <- 0; nO <- 0
while ((nS < 30 || nO < 60) && tries < 4000) {
  tries <- tries + 1
  kind <- sample(c("lmer", "lmer", "glmer"), 1)
  P <- sample(14:36, 1); reps <- sample(4:8, 1)
  d <- expand.grid(rep = 1:reps, cond = c(0, 1), id = factor(1:P)); n <- nrow(d)
  slope <- kind == "lmer" && runif(1) < 0.75
  sdI <- if (kind == "lmer") sample(c(4, 8, 12), 1) else sample(c(0.8, 1.2), 1)
  sdS <- if (slope) sample(c(0, 0, 2, 5), 1) else 0
  u0 <- rnorm(P, 0, sdI)[d$id]; u1 <- rnorm(P, 0, max(sdS, 1e-9))[d$id] * (sdS > 0)
  if (kind == "lmer") {
    beta <- c(sample(c(40, 50, 60), 1), sample(c(-6, -3, 3, 6), 1)); sdE <- sample(c(5, 9), 1)
    d$y <- beta[1] + beta[2] * d$cond + u0 + u1 * d$cond + rnorm(n, 0, sdE)
    f <- if (slope) y ~ cond + (1 + cond | id) else y ~ cond + (1 | id)
    m <- suppressMessages(suppressWarnings(lmer(f, d)))
  } else {
    beta <- c(sample(c(-1, -0.5, 0.5, 1), 1), sample(c(-1, -0.6, 0.6, 1), 1))
    d$y <- rbinom(n, 1, plogis(beta[1] + beta[2] * d$cond + u0))
    f <- y ~ cond + (1 | id)
    m <- suppressMessages(suppressWarnings(glmer(f, d, family = binomial)))
  }
  vc <- as.data.frame(VarCorr(m)); cf <- coef(summary(m)); si <- isSingular(m)
  if (kind == "glmer" && (any(cf[, 2] < 0.05) || any(abs(cf[, 3]) > 12))) next   # degenerate fits (separation) make poor teaching examples
  re <- lapply(which(vc$grp != "Residual" & is.na(vc$var2)), function(i) list(grp = "id", name = if (vc$var1[i] == "(Intercept)") "Intercept" else vc$var1[i], sd = r2(vc$sdcor[i], 2)))
  cr <- vc$sdcor[!is.na(vc$var2)]
  if (length(cr)) re[[2]]$corr <- if (is.nan(cr)) "NaN" else r2(cr, 2)
  sdres <- if (kind == "lmer") r2(sigma(m), 2) else NA
  info <- sing_info(m)
  # Keep clear examples only: a singular fit must SHOW its problem (0.00 SD or +-1.00 correlation),
  # a healthy one must not look suspicious at two decimals.
  shown <- unlist(lapply(re, function(x) x$sd)); shownc <- if (length(cr) && !is.nan(cr)) r2(cr, 2) else numeric(0)
  clearSing <- (any(shown == 0, na.rm = TRUE) || any(abs(shownc) == 1)) && !any(shown < 0.05 & shown > 0)
  clearOK <- all(shown >= 0.3, na.rm = TRUE) && all(abs(shownc) <= 0.9) && !si
  if (!(si && clearSing) && !clearOK) next
  if (si && !(info$zeroSD || info$corr1)) next
  if ((si && nS >= 30) || (!si && nO >= 60)) next
  if (si) nS <- nS + 1 else nO <- nO + 1
  fe <- lapply(seq_len(nrow(cf)), function(i) { x <- list(name = if (rownames(cf)[i] == "(Intercept)") "Intercept" else rownames(cf)[i], est = r2(cf[i, 1], 2), se = r2(cf[i, 2], 2), stat = r2(cf[i, 3], 2)); if (kind == "glmer") x$p <- signif(cf[i, 4], 3); x })
  outs[[length(outs) + 1]] <- list(kind = kind, formula = paste(deparse(f), collapse = ""), slope = slope, n = n, ngroups = P, re = re, resid = sdres, fe = fe,
                                   singular = si, why = if (!si) NULL else if (info$corr1) "corr" else "var")
}
cat("printouts:", length(outs), " singular:", sum(sapply(outs, function(o) o$singular)), " glmer:", sum(sapply(outs, function(o) o$kind == "glmer")), "\n")

## ---------- 2. shrinkage: four people, different amounts of data, real BLUPs -----------
set.seed(7)
shr <- list(); tries <- 0
while (length(shr) < 70 && tries < 3000) {
  tries <- tries + 1
  ns <- sample(c(1, 2, 3, 4, 6, 8, 10), 4)
  sdU <- sample(c(1.0, 1.5, 2.0), 1); sdE <- sample(c(0.8, 1.5, 2.5), 1); b <- sample(c(0.5, 1, -0.5, -1), 1)
  ui <- rnorm(4, 0, sdU)
  d <- do.call(rbind, lapply(1:4, function(i) { x <- sort(runif(ns[i], 0, 5)); data.frame(id = factor(i), x = x, y = 3 + b * x + ui[i] + rnorm(ns[i], 0, sdE)) }))
  d <- rbind(d, do.call(rbind, lapply(5:30, function(i) { x <- runif(4, 0, 5); data.frame(id = factor(i), x = x, y = 3 + b * x + rnorm(1, 0, sdU) + rnorm(4, 0, sdE)) })))  # other people, so the variance components are estimable
  m <- suppressMessages(suppressWarnings(lmer(y ~ x + (1 | id), d)))
  if (isSingular(m)) next
  fx <- fixef(m); u <- ranef(m)$id[, 1]
  own <- sapply(1:4, function(i) { s <- d[d$id == i, ]; mean(s$y) - fx[2] * mean(s$x) })
  blup <- fx[1] + u[1:4]
  move <- abs(blup - own); ord <- order(-move)
  if (move[ord[1]] < 1.25 * move[ord[2]] || move[ord[1]] < 0.35) next
  # the obvious guesses must not be right: farthest from the group line, and fewest points
  far <- which.max(abs(own - (fx[1])))
  if (ord[1] == far && ord[1] == which.min(ns)) next
  if (ord[1] == which.min(ns) && runif(1) < 0.7) next
  if (ord[1] == far && runif(1) < 0.7) next
  pts <- lapply(1:4, function(i) { s <- d[d$id == i, ]; list(x = r2(s$x, 2), y = r2(s$y, 2)) })
  shr[[length(shr) + 1]] <- list(a = r2(fx[1], 3), b = r2(fx[2], 3), pts = pts, own = r2(own, 3), blup = r2(blup, 3), ans = ord[1] - 1, n = ns,
                                 sdU = r2(attr(VarCorr(m)$id, "stddev"), 3), sdE = r2(sigma(m), 3))
}
cat("shrink:", length(shr), "\n")

## ---------- 3. what leaving the slope out costs: SE with and without the random slope -----------
set.seed(11)
cost <- list(); tries <- 0
while (length(cost) < 60 && tries < 600) {
  tries <- tries + 1
  P <- sample(20:32, 1); reps <- 6; d <- expand.grid(rep = 1:reps, cond = c(0, 1), id = factor(1:P))
  sdS <- sample(c(0, 0, 4, 6), 1); sdI <- 8; eff <- sample(c(2, 3, 4), 1)
  u0 <- rnorm(P, 0, sdI); u1 <- if (sdS > 0) rnorm(P, 0, sdS) else rep(0, P)
  d$y <- 50 + eff * d$cond + u0[d$id] + u1[d$id] * d$cond + rnorm(nrow(d), 0, 6)
  m1 <- suppressMessages(suppressWarnings(lmer(y ~ cond + (1 | id), d)))
  m2 <- suppressMessages(suppressWarnings(lmer(y ~ cond + (1 + cond | id), d)))
  s1 <- coef(summary(m1))["cond", 2]; s2 <- coef(summary(m2))["cond", 2]; e1 <- coef(summary(m1))["cond", 1]
  kind <- if (s2 / s1 >= 1.4) "wider" else if (abs(s2 / s1 - 1) <= 0.04 && sdS == 0) "same" else next
  cost[[length(cost) + 1]] <- list(eff = r2(e1, 2), se1 = r2(s1, 2), se2 = r2(s2, 2), kind = kind, sdS = sdS)
}
cat("cost:", length(cost), " wider:", sum(sapply(cost, function(o) o$kind == "wider")), "\n")

pools <- list(outs = outs, shrink = shr, cost = cost)
writeLines(c("// Generated by tools/make-pools.R from real lme4 fits. Do not edit by hand.",
             paste0("window.POOLS = ", toJSON(pools, auto_unbox = TRUE, na = "null", digits = NA), ";")), "pools.js")
cat("wrote pools.js\n")
