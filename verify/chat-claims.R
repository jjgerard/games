# Checks claims made in the learning chats before they become answer keys.
suppressMessages({library(lme4); library(dplyr); library(tidyr)})
ok <- function(label, cond) cat(sprintf("%-4s %s\n", if (isTRUE(cond)) "PASS" else "FAIL", label))

# glmer chat: link-scale arithmetic
ok("plogis(4.38) ~ .988",           abs(plogis(4.38) - .9876) < 1e-3)
ok("exp(4.38) ~ 79.8",               abs(exp(4.38) - 79.8) < .1)
p <- c(.2, .2, .6, .999)
ok("mean prob ~ .49975",            abs(mean(p) - .49975) < 1e-6)
ok("mean logit ~ 1.135",            abs(mean(qlogis(p)) - 1.135) < 1e-3)
ok("plogis(mean logit) ~ .757",     abs(plogis(mean(qlogis(p))) - .757) < 1e-3)

# glmer chat: +/-.5 coding -> intercept = mean of the eight cell log-odds, coefficient = full difference
set.seed(1)
cells <- expand.grid(A = c(-.5, .5), C = c(-.5, .5), G = c(-.5, .5))
beta <- c(4.38, -5.74, -0.04, -3.11, -0.18, 4.79, 3.10, -3.71)
X <- model.matrix(~ A * C * G, cells)
eta <- as.vector(X %*% beta)
ok("intercept = mean of 8 cell log-odds", abs(mean(eta) - 4.38) < 1e-9)
ok("A coef = diff between A levels (avg over C,G)", abs(mean(eta[cells$A == .5]) - mean(eta[cells$A == -.5]) - (-5.74)) < 1e-9)

# glmer chat: ceiling cells inflate the intercept while the mean probability is far lower
cat(sprintf("     example: mean prob of 8 cells %.3f vs plogis(mean logit) %.3f\n",
            mean(plogis(eta)), plogis(mean(eta))))

# coding chat: lm slope from the chat, x = 800..1200
ok("lm predictions at 800/1200 are positive", {
  b0 <- -0.2732; b1 <- 4.561e-4; all(b0 + b1 * c(800, 1200) > 0) })
ok("logit example: plogis(-.273 + .000456*1000) ~ .545", abs(plogis(-.273 + .000456*1000) - .545) < .001)
ok("negative slope can still give positive log-odds: 1.05 -> .58", abs((1.05 - .47) - .58) < 1e-9)

# Likert chat: does (1|participant) imply correlated responses across questions?
set.seed(2)
n <- 400; q <- 5
d <- data.frame(participant = factor(rep(1:n, each = q)), question = factor(rep(1:q, n)))
d$y <- rnorm(n, 0, 1)[as.integer(d$participant)] + rnorm(n * q, 0, 1)
w <- tidyr::pivot_wider(d, names_from = question, values_from = y, id_cols = participant)
r <- cor(w[,-1])[upper.tri(diag(q))]
ok("random intercept data: between-question correlation ~ .5 (not independent)", abs(mean(r) - .5) < .06)

# Likert chat: one observation per participant x question
d$id_q <- interaction(d$participant, d$question)
res <- tryCatch(lmer(y ~ question + (1|participant) + (1|id_q), data = d), error = function(e) conditionMessage(e))
ok("(1|participant:question) with 1 obs/cell errors", is.character(res) && grepl("must be < number of observations", res))
cat("     message:", if (is.character(res)) res else "(fit)", "\n")

# Likert chat: is a full question*time*population interaction estimable? Balanced design -> yes.
set.seed(3)
g <- expand.grid(question = factor(1:13), time = factor(1:3), population = factor(1:4))
sub <- data.frame(participant = factor(1:480), time = factor(rep(1:3, each = 160)),
                  population = factor(rep(rep(1:4, each = 40), 3)))
d3 <- merge(sub, data.frame(question = factor(1:13)))
d3$y <- rnorm(nrow(d3))
m <- lmer(y ~ question * time * population + (1|participant), data = d3)
ok("balanced full 3-way model fits with no rank deficiency", !any(grepl("rank deficient", capture.output(print(summary(m)))))
   && length(fixef(m)) == 13*3*4)
# ...and rank deficiency appears when a cell is empty (e.g. population 4 absent in time 3)
d4 <- subset(d3, !(population == "4" & time == "3"))
m4 <- suppressWarnings(lmer(y ~ question * time * population + (1|participant), data = d4))
ok("empty time x population cell -> rank deficient (dropped columns)", length(fixef(m4)) < 13*3*4 || any(is.na(fixef(m4))))

# tidy chat: mutate vs summarise row counts; n() vs nrow(data); join direction
set.seed(4)
t <- data.frame(subject = rep(c("a","b","c"), c(14, 8, 12)), condition = rep(c("x","y"), 17), response = rnorm(34))
r1 <- t %>% group_by(subject) %>% mutate(m = mean(response))
r2 <- t %>% group_by(subject) %>% summarise(m = mean(response))
ok("grouped mutate keeps 34 rows; summarise gives 3", nrow(r1) == 34 && nrow(r2) == 3)
nn <- t %>% group_by(subject) %>% mutate(n_trials = nrow(t))
ok("nrow(data) inside grouped mutate is 34 for everyone", all(nn$n_trials == 34))
f <- t %>% group_by(subject) %>% mutate(n_trials = n()) %>% filter(n_trials >= 10) %>% ungroup()
ok("n() filter keeps subjects a (14) and c (12)", setequal(unique(f$subject), c("a","c")))
x <- data.frame(subject = c("a","b"), r = 1:2); y <- data.frame(participant = c("a","b"), wm = c(.5,.7))
ok("left_join(by=c(left=right)) adds wm", "wm" %in% names(left_join(x, y, by = c("subject" = "participant"))))
ok("group_by(subject,condition,age_years) summarise leaves those cols + mean", {
  z <- data.frame(subject = rep(1:2, each = 4), condition = rep(c("x","y"), 4), age = rep(c(50, 60), each = 4), response = 1:8) %>%
    mutate(age_years = age / 12) %>% group_by(subject, condition, age_years) %>% summarise(mean_response = mean(response), .groups = "drop")
  setequal(names(z), c("subject","condition","age_years","mean_response")) && nrow(z) == 4 })
