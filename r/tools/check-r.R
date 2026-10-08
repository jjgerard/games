# Runs every recorded answer key in real R (base R + dplyr + tidyr; ggplot2 only for existence/parse) and compares.
#   Rscript tools/check-r.R /tmp/claude-0/rchecks.json
suppressPackageStartupMessages({ library(jsonlite); library(dplyr); library(tidyr); library(ggplot2) })
args <- commandArgs(TRUE); recs <- fromJSON(args[1], simplifyVector = FALSE)
tmp <- tempfile(); dir.create(tmp); setwd(tmp)
nul <- function(x) if (is.null(x)) NA else x
vec <- function(l) unlist(lapply(l, nul), use.names = FALSE)
same_vec <- function(res, exp) {
  e <- vec(exp); r <- as.vector(res)
  if (length(r) != length(e)) return(sprintf("length %d vs %d", length(r), length(e)))
  if (is.character(e) || is.character(r)) { if (!identical(as.character(r), as.character(e))) return(sprintf("got %s expected %s", paste(r, collapse=","), paste(e, collapse=","))); return(NULL) }
  if (is.logical(e) && is.numeric(r)) r <- as.logical(r)
  ok <- mapply(function(a, b) (is.na(a) && is.na(b)) || (!is.na(a) && !is.na(b) && isTRUE(all.equal(as.numeric(a), as.numeric(b)))), r, e)
  if (!all(ok)) return(sprintf("got %s expected %s", paste(r, collapse=","), paste(e, collapse=",")))
  NULL
}
same_df <- function(res, exp) {
  res <- as.data.frame(ungroup(res)); cols <- exp$df; if (!identical(names(res), names(cols))) return(sprintf("names %s vs %s", paste(names(res), collapse=","), paste(names(cols), collapse=",")))
  for (n in names(cols)) { e <- cols[[n]]; if (length(e) == 0) { if (nrow(res) != 0) return("rows"); next }; m <- same_vec(if (is.factor(res[[n]])) as.character(res[[n]]) else res[[n]], e); if (!is.null(m)) return(paste(n, m)) }
  if (length(cols) && nrow(res) != length(cols[[1]])) return(sprintf("nrow %d vs %d", nrow(res), length(cols[[1]])))
  NULL
}
env_run <- function(setup) { e <- new.env(parent = globalenv()); if (nzchar(setup)) eval(parse(text = setup), e); e }
check <- function(r) {
  k <- r$kind
  if (is.null(k)) {
    e <- env_run(if (is.null(r$setup)) "" else r$setup); res <- eval(parse(text = r$expr), e); ex <- r$expect
    if (is.null(ex)) return(NULL)
    if (is.list(ex) && !is.null(ex$df)) return(same_df(res, ex))
    if (is.list(ex) && !is.null(ex$mat)) { m <- ex$mat; if (nrow(res) != m$nrow) return("matrix nrow"); return(same_vec(as.vector(t(res)), m$byrow)) }
    return(same_vec(res, ex))
  }
  if (k == "print") { out <- capture.output(print(eval(parse(text = r$code)))); return(if (identical(paste(out, collapse="\n"), r$expect)) NULL else sprintf("printed %s", paste(out, collapse="|"))) }
  if (k == "comments") { got <- sapply(r$lines, function(l) length(parse(text = l)) > 0); return(if (all(got == unlist(r$expect))) NULL else "comment/run mismatch") }
  if (k == "visible") { e <- new.env(parent = globalenv()); got <- sapply(r$lines, function(l) { out <- capture.output(source(textConnection(l), local = e, print.eval = TRUE, echo = FALSE)); length(out) > 0 }); return(if (all(got == unlist(r$expect))) NULL else sprintf("prints: got %s expected %s", paste(got, collapse=","), paste(unlist(r$expect), collapse=","))) }
  if (k == "names") { got <- sapply(r$names, function(x) make.names(x) == x); return(if (all(got == unlist(r$expect))) NULL else "names mismatch") }
  if (k == "error") { e <- env_run(if (is.null(r$setup)) "" else r$setup); msg <- tryCatch({ eval(parse(text = r$code), e); NA_character_ }, error = function(err) conditionMessage(err));
    if (is.na(msg)) return("expected an error but none"); return(if (grepl(r$contains, msg, fixed = TRUE)) NULL else sprintf("error text '%s' lacks '%s'", msg, r$contains)) }
  if (k == "syntax") { invisible(parse(text = r$code)); return(NULL) }
  if (k == "exists") { for (f in unlist(r$fns)) if (!exists(f)) return(paste("missing", f)); return(NULL) }
  if (k == "random") { runs <- lapply(1:15, function(i) { e <- new.env(parent = globalenv()); lapply(r$lines, function(l) tryCatch(eval(parse(text = l), e), error = function(x) "err")) })
    got <- sapply(seq_along(r$lines), function(j) any(sapply(runs[-1], function(x) !identical(x[[j]], runs[[1]][[j]])))); return(if (all(got == unlist(r$expect))) NULL else sprintf("changes: got %s expected %s", paste(got, collapse=","), paste(unlist(r$expect), collapse=","))) }
  if (k == "seedvars") { run <- function() { e <- new.env(parent = globalenv()); for (l in r$lines) eval(parse(text = l), e); mget(unlist(r$vars), envir = e) }
    set.seed(NULL); r1 <- run(); r2 <- run(); got <- sapply(unlist(r$vars), function(v) identical(r1[[v]], r2[[v]])); return(if (all(unname(got) == unlist(r$expect))) NULL else sprintf("repeat: got %s", paste(got, collapse=","))) }
  paste("unknown kind", k)
}
fails <- 0; n <- 0; bysub <- list()
for (r in recs) {
  n <- n + 1; msg <- tryCatch(check(r), error = function(e) paste("R error:", conditionMessage(e)))
  bysub[[r$sub]] <- (if (is.null(bysub[[r$sub]])) 0 else bysub[[r$sub]]) + 1
  if (!is.null(msg)) { fails <- fails + 1; if (fails <= 25) cat(sprintf("FAIL [%s] %s\n   %s\n", r$sub, if (!is.null(r$expr)) r$expr else if (!is.null(r$code)) r$code else r$kind, msg)) }
}
cat(sprintf("%d R checks run, %d failed (sub-levels covered: %d)\n", n, fails, length(bysub)))
cat("R", R.version.string, "| dplyr", as.character(packageVersion("dplyr")), "| tidyr", as.character(packageVersion("tidyr")), "| ggplot2", as.character(packageVersion("ggplot2")), "\n")
quit(status = if (fails) 1 else 0)
